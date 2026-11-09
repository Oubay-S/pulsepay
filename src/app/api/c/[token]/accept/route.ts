import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeAgreement } from '@/lib/paypal/executor';
import { resolvePayableInvoice } from '@/lib/paypal/payer';
import { ProposalSchema } from '@/lib/guard/schemas';
import type { NegotiationProposal } from '@/types/proposals';

const NEGOTIATION_TYPES = ['discount', 'plan', 'pay_later'] as const;

// The executor creates, sends, and cancels real PayPal invoices.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const arrangementId = body.arrangement_id;

    if (!arrangementId) {
      return NextResponse.json({ error: 'arrangement_id is required' }, { status: 400 });
    }

    // Verify conversation
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, invoice_id, status')
      .eq('token', token)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ error: 'Invalid conversation token' }, { status: 404 });
    }

    // Retrieve arrangement
    const { data: arrangement, error: arrErr } = await supabase
      .from('arrangements')
      .select('*, invoice:invoices(*)')
      .eq('id', arrangementId)
      .single();

    if (arrErr || !arrangement) {
      return NextResponse.json({ error: 'Arrangement not found' }, { status: 404 });
    }

    // A token may only accept arrangements that belong to its own invoice.
    if (arrangement.invoice_id !== conversation.invoice_id) {
      return NextResponse.json({ error: 'Arrangement not found' }, { status: 404 });
    }

    if (conversation.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This conversation is paused while the business owner reviews it.' },
        { status: 409 }
      );
    }

    if (arrangement.status !== 'PROPOSED') {
      return NextResponse.json(
        { error: `Arrangement cannot be accepted in current status (${arrangement.status})` },
        { status: 400 }
      );
    }

    // Stored terms are re-validated before any money moves.
    const parsed = ProposalSchema.safeParse(arrangement.terms);
    if (
      !parsed.success ||
      !NEGOTIATION_TYPES.includes(parsed.data.type as (typeof NEGOTIATION_TYPES)[number])
    ) {
      return NextResponse.json(
        { error: 'This offer cannot be accepted. Please ask for a new offer.' },
        { status: 400 }
      );
    }
    const proposal = parsed.data as NegotiationProposal;

    // Claim the arrangement atomically so a double click cannot run the executor twice.
    const { data: claimed, error: claimErr } = await supabase
      .from('arrangements')
      .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
      .eq('id', arrangement.id)
      .eq('status', 'PROPOSED')
      .select('id')
      .maybeSingle();

    if (claimErr) {
      return NextResponse.json({ error: claimErr.message }, { status: 500 });
    }
    if (!claimed) {
      return NextResponse.json(
        { error: 'This offer is already being processed.' },
        { status: 409 }
      );
    }

    // Execute through PayPal Executor
    const executionResult = await executeAgreement(proposal, arrangement.invoice, arrangement.id);

    if (!executionResult.success) {
      // Release the claim so the client can retry.
      await supabase
        .from('arrangements')
        .update({ status: 'PROPOSED', updated_at: new Date().toISOString() })
        .eq('id', arrangement.id)
        .eq('status', 'ACCEPTED');

      return NextResponse.json(
        { error: `Failed to set up agreement in PayPal: ${executionResult.error}` },
        { status: 500 }
      );
    }

    const { data: updatedArrangement, error: updateErr } = await supabase
      .from('arrangements')
      .select('*, installments(*)')
      .eq('id', arrangement.id)
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Add confirmation message into conversation
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'AGENT',
      content: 'Great news! Your payment arrangement has been confirmed and set up in PayPal.',
      intent: 'ARRANGEMENT_ACCEPTED',
    });

    // A discount moves the conversation to the reissued invoice; a plan keeps
    // it on the superseded parent. Resolve the real payable target either way.
    const { data: refreshedConversation } = await supabase
      .from('conversations')
      .select('invoice:invoices(*)')
      .eq('id', conversation.id)
      .single();

    const refreshedInvoice = refreshedConversation?.invoice
      ? Array.isArray(refreshedConversation.invoice)
        ? refreshedConversation.invoice[0]
        : refreshedConversation.invoice
      : null;

    const payable = refreshedInvoice
      ? await resolvePayableInvoice(supabase, refreshedInvoice)
      : null;

    const executionPayerLink =
      typeof executionResult.details?.payerLink === 'string'
        ? executionResult.details.payerLink
        : null;

    return NextResponse.json({
      success: true,
      arrangement: updatedArrangement,
      execution: executionResult,
      payable,
      payer_link: payable?.payer_link ?? executionPayerLink,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

