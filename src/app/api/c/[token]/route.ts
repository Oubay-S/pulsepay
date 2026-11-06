import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
      messages: messages || [],
      offers: offers || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

