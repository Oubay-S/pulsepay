import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeAgreement } from '@/lib/paypal/executor';
import { resolvePayableInvoice } from '@/lib/paypal/payer';
import type { NegotiationProposal } from '@/types/proposals';

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

    const invoice = arrangement.invoice;

    if (action === 'approve') {
      const proposal = arrangement.terms as unknown as NegotiationProposal;
      const executionResult = await executeAgreement(proposal, invoice, arrangement.id);

      if (!executionResult.success) {
        return NextResponse.json(
          { error: `Execution failed: ${executionResult.error}` },
          { status: 500 }
        );
      }

      const { data: updatedArr, error: updateErr } = await supabase
        .from('arrangements')
        .update({
          status: 'ACCEPTED',
          approved_by: 'OWNER',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // If there's an active conversation, notify client
      if (arrangement.conversation_id) {
        await supabase.from('messages').insert({
          conversation_id: arrangement.conversation_id,
          sender: 'OWNER',
          content: 'The business owner has approved this custom arrangement. Your agreement is now set up in PayPal!',
        });
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

      const { data: updatedArr } = await supabase
        .from('arrangements')
        .update({
          terms: counter_terms,
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
          content: 'The business owner reviewed your request and proposed the revised terms shown below.',
        });
      }

      return NextResponse.json({ success: true, arrangement: updatedArr });
    }

    return NextResponse.json({ error: 'Unhandled action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

