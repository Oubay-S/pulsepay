import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeAgreement } from '@/lib/paypal/executor';
import type { NegotiationProposal } from '@/types/proposals';

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
      .select('id, invoice_id')
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

    if (arrangement.status !== 'PROPOSED') {
      return NextResponse.json(
        { error: `Arrangement cannot be accepted in current status (${arrangement.status})` },
        { status: 400 }
      );
    }

    // Execute through PayPal Executor
    const proposal = arrangement.terms as unknown as NegotiationProposal;
    const executionResult = await executeAgreement(proposal, arrangement.invoice, arrangement.id);

    if (!executionResult.success) {
      return NextResponse.json(
        { error: `Failed to set up agreement in PayPal: ${executionResult.error}` },
        { status: 500 }
      );
    }

    // Update arrangement status
    const { data: updatedArrangement, error: updateErr } = await supabase
      .from('arrangements')
      .update({
        status: 'ACCEPTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', arrangement.id)
      .select('*, installments(*)')
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

    return NextResponse.json({
      success: true,
      arrangement: updatedArrangement,
      execution: executionResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

