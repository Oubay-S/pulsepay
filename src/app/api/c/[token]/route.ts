import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePayableInvoice } from '@/lib/paypal/payer';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const supabase = createAdminClient();

    // Fetch conversation with invoice, business, client
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('*, invoice:invoices(*, business:businesses(name, currency, tone), client:clients(name, email))')
      .eq('token', token)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const invoice = conversation.invoice;

    // Fetch messages
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    // Fetch arrangements (proposed or accepted)
    const { data: offers } = await supabase
      .from('arrangements')
      .select('*, installments(*)')
      .eq('invoice_id', invoice.id)
      .in('status', ['PROPOSED', 'PENDING_APPROVAL', 'ACCEPTED'])
      .order('created_at', { ascending: false });

    // What the client can pay right now. For a plan, this is the current
    // SENT installment rather than the SUPERSEDED parent invoice.
    const payable = await resolvePayableInvoice(supabase, invoice);

    return NextResponse.json({
      conversation_id: conversation.id,
      status: conversation.status,
      business_name: invoice.business?.name || 'PulsePay Merchant',
      invoice: {
        id: invoice.id,
        paypal_invoice_id: invoice.paypal_invoice_id,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        due_date: invoice.due_date,
        description: invoice.description,
        status: invoice.status,
      },
      payable,
      paylater: {
        available: invoice.status === 'SENT',
        amount: Number(invoice.amount),
        currency: invoice.currency,
        create_url: `/api/c/${token}/paylater/create`,
        capture_url: `/api/c/${token}/paylater/capture`,
      },
      messages: messages || [],
      offers: offers || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

