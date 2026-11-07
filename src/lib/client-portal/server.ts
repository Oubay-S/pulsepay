import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoNow } from '@/lib/demo-clock';
import type { ClientPortalPayload } from './types';

export class ConversationNotFoundError extends Error {
  constructor() {
    super('Conversation not found');
    this.name = 'ConversationNotFoundError';
  }
}

/**
 * Shared server-side query for the client portal.
 * Used by both the page (first paint) and GET /api/c/[token] (polling).
 */
export async function getClientPortalPayload(token: string): Promise<ClientPortalPayload> {
  const supabase = createAdminClient();

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select(
      '*, invoice:invoices(*, business:businesses(name, currency, tone), client:clients(name, email))'
    )
    .eq('token', token)
    .single();

  if (conversationError || !conversation) {
    throw new ConversationNotFoundError();
  }

  const invoice = conversation.invoice;
  if (!invoice) {
    throw new ConversationNotFoundError();
  }

  const [demoNow, messagesResult, offersResult] = await Promise.all([
    getDemoNow(),
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('arrangements')
      .select('*, installments(*)')
      .eq('invoice_id', invoice.id)
      .in('status', ['PROPOSED', 'PENDING_APPROVAL', 'ACCEPTED'])
      .order('created_at', { ascending: false }),
  ]);

  return {
    conversation_id: conversation.id,
    status: conversation.status,
    business_name: invoice.business?.name || 'PulsePay Merchant',
    client_name: invoice.client?.name || null,
    business_tone: invoice.business?.tone || null,
    demo_now: demoNow.toISOString(),
    invoice: {
      id: invoice.id,
      paypal_invoice_id: invoice.paypal_invoice_id,
      amount: Number(invoice.amount),
      currency: invoice.currency || 'USD',
      due_date: invoice.due_date,
      description: invoice.description ?? null,
      status: invoice.status,
    },
    messages: messagesResult.data || [],
    offers: offersResult.data || [],
  };
}
