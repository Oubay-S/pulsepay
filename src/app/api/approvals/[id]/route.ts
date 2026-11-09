import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeAgreement } from '@/lib/paypal/executor';
import { ProposalSchema } from '@/lib/guard/schemas';
import { resolvePayableInvoice } from '@/lib/paypal/payer';
import type { NegotiationProposal } from '@/types/proposals';

const NEGOTIATION_TYPES = ['discount', 'plan', 'pay_later'] as const;

// The executor creates, sends, and cancels real PayPal invoices.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const { action, reason, counter_terms } = body;

    if (!['approve', 'reject', 'counter'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve, reject, or counter' },
        { status: 400 }
      );
    }

    // Retrieve arrangement and associated invoice
    const { data: arrangement, error: arrErr } = await supabase
      .from('arrangements')
      .select('*, invoice:invoices(*)')
      .eq('id', id)
      .single();

    if (arrErr || !arrangement) {
      return NextResponse.json({ error: 'Arrangement not found' }, { status: 404 });
    }

    if (arrangement.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: `This request is no longer pending (status: ${arrangement.status}).` },
        { status: 400 }
      );
    }

    const invoice = arrangement.invoice;
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (action === 'approve') {
      const parsed = ProposalSchema.safeParse(arrangement.terms);

      if (
        !parsed.success ||
        !NEGOTIATION_TYPES.includes(parsed.data.type as (typeof NEGOTIATION_TYPES)[number])
      ) {
        return NextResponse.json(
          {
            error:
              'This is a client request, not an executable proposal. Send a counter-offer with valid terms instead.',
          },
          { status: 400 }
        );
      }

      const proposal = parsed.data as NegotiationProposal;

      if (proposal.type === 'plan') {
        const total = proposal.installments.reduce((sum, item) => sum + item.amount, 0);
        if (total > invoice.amount + 0.05) {
          return NextResponse.json(
            { error: 'An approved plan cannot total more than the original invoice.' },
            { status: 400 }
          );
        }
      }

      if (
        proposal.type === 'pay_later' &&
        Math.abs(proposal.invoice_amount - invoice.amount) > 0.01
      ) {
        return NextResponse.json(
          { error: 'Pay Later must match the invoice amount.' },
          { status: 400 }
        );
      }

      // Claim atomically so a double click cannot run the executor twice.
      const { data: updatedArr, error: claimErr } = await supabase
        .from('arrangements')
        .update({
          status: 'ACCEPTED',
          approved_by: 'OWNER',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'PENDING_APPROVAL')
        .select()
        .maybeSingle();

      if (claimErr) {
        return NextResponse.json({ error: claimErr.message }, { status: 500 });
      }
      if (!updatedArr) {
        return NextResponse.json(
          { error: 'This request is already being processed.' },
          { status: 409 }
        );
      }

      const executionResult = await executeAgreement(proposal, invoice, arrangement.id);

      if (!executionResult.success) {
        // Release the claim so the owner can retry.
        await supabase
          .from('arrangements')
          .update({
            status: 'PENDING_APPROVAL',
            approved_by: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('status', 'ACCEPTED');

        return NextResponse.json(
          { error: `Execution failed: ${executionResult.error}` },
          { status: 500 }
        );
      }

      // If there's an active conversation, notify client and resume automation.
      if (arrangement.conversation_id) {
        await supabase.from('messages').insert({
          conversation_id: arrangement.conversation_id,
          sender: 'OWNER',
          content:
            'The business owner has approved this custom arrangement. Your agreement is now set up in PayPal!',
        });

        await supabase
          .from('conversations')
          .update({ status: 'ACTIVE' })
          .eq('id', arrangement.conversation_id)
          .in('status', ['DISPUTED', 'ESCALATED']);
      }

      // A discount creates a reissued child invoice; a plan keeps the
      // superseded parent and sends installment 1.
      const { data: childInvoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('parent_invoice_id', invoice.paypal_invoice_id)
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const payable = await resolvePayableInvoice(
        supabase,
        childInvoice ?? invoice
      );

      const executionPayerLink =
        typeof executionResult.details?.payerLink === 'string'
          ? executionResult.details.payerLink
          : null;

      return NextResponse.json({
        success: true,
        arrangement: updatedArr,
        execution: executionResult,
        payable,
        payer_link: payable?.payer_link ?? executionPayerLink,
      });
    }

    if (action === 'reject') {
      const { data: updatedArr } = await supabase
        .from('arrangements')
        .update({
          status: 'REJECTED',
          rejection_reason: reason || 'Declined by business owner',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (arrangement.conversation_id) {
        await supabase.from('messages').insert({
          conversation_id: arrangement.conversation_id,
          sender: 'OWNER',
          content: reason
            ? `The owner was unable to approve this request: ${reason}`
            : 'The business owner was unable to approve this proposal.',
        });
      }

      return NextResponse.json({ success: true, arrangement: updatedArr });
    }

    if (action === 'counter') {
      if (!counter_terms) {
        return NextResponse.json({ error: 'counter_terms required for counter action' }, { status: 400 });
      }

      const parsed = ProposalSchema.safeParse(counter_terms);
      if (
        !parsed.success ||
        !NEGOTIATION_TYPES.includes(parsed.data.type as (typeof NEGOTIATION_TYPES)[number])
      ) {
        return NextResponse.json(
          {
            error: 'Counter terms must be a valid discount, plan, or Pay Later proposal.',
            details: parsed.success ? undefined : parsed.error.issues,
          },
          { status: 400 }
        );
      }

      const proposal = parsed.data as NegotiationProposal;

      if (proposal.type === 'plan') {
        const total = proposal.installments.reduce((sum, item) => sum + item.amount, 0);
        if (total > invoice.amount + 0.05) {
          return NextResponse.json(
            { error: 'A counter-plan cannot total more than the original invoice.' },
            { status: 400 }
          );
        }
      }

      if (
        proposal.type === 'pay_later' &&
        Math.abs(proposal.invoice_amount - invoice.amount) > 0.01
      ) {
        return NextResponse.json(
          { error: 'Pay Later must match the invoice amount.' },
          { status: 400 }
        );
      }

      const { data: updatedArr } = await supabase
        .from('arrangements')
        .update({
          terms: proposal,
          status: 'PROPOSED',
          approved_by: 'OWNER',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (arrangement.conversation_id) {
        await supabase.from('messages').insert({
          conversation_id: arrangement.conversation_id,
          sender: 'OWNER',
          content:
            'The business owner reviewed your request and proposed the revised terms shown below.',
        });

        // A counter-offer is the owner's decision, so the conversation can
        // return to the normal accept/decline flow.
        await supabase
          .from('conversations')
          .update({ status: 'ACTIVE' })
          .eq('id', arrangement.conversation_id)
          .in('status', ['DISPUTED', 'ESCALATED']);
      }

      return NextResponse.json({ success: true, arrangement: updatedArr });
    }

    return NextResponse.json({ error: 'Unhandled action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
