import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoNow } from '@/lib/demo-clock';
import { resolvePayableInvoice } from '@/lib/paypal/payer';
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

  // Accepting a discount reissues the invoice and moves the conversation to the
  // child. The arrangement still points at the parent, so look at both plus the
  // conversation itself — otherwise the client sees "No options yet" right after
  // accepting an offer.
  const invoiceIds = new Set<string>([invoice.id]);

  if (invoice.parent_invoice_id) {
    // parent_invoice_id stores the PayPal invoice ID, not the database UUID.
    const { data: parentInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('paypal_invoice_id', invoice.parent_invoice_id)
      .maybeSingle();

    if (parentInvoice?.id) invoiceIds.add(parentInvoice.id);
  }

  const offersFilter = [
    `conversation_id.eq.${conversation.id}`,
    `invoice_id.in.(${[...invoiceIds].join(',')})`,
  ].join(',');

  const [demoNow, messagesResult, offersResult, payable] = await Promise.all([
    getDemoNow(),
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('arrangements')
      .select('*, installments(*)')
      .or(offersFilter)
      .in('status', ['PROPOSED', 'PENDING_APPROVAL', 'ACCEPTED'])
      .order('created_at', { ascending: false }),
    // A failed payable lookup must not take down the whole client page.
    resolvePayableInvoice(supabase, invoice).catch(() => null),
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
    payable,
    paylater: {
      available: invoice.status === 'SENT',
      amount: Number(invoice.amount),
      currency: invoice.currency || 'USD',
      create_url: `/api/c/${token}/paylater/create`,
      capture_url: `/api/c/${token}/paylater/capture`,
    },
    messages: messagesResult.data || [],
    offers: offersResult.data || [],
  };
}
