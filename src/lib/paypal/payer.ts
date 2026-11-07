// ============================================================
// PulsePay — PayPal Payer Links
//
// Converts a PayPal invoice ID into the URL the client opens to pay.
// The link is stable, so it does not need to be persisted: it can be
// rebuilt on every client-page request from `paypal_invoice_id`.
//
// `send_invoice` returns the same URL as `payer-view`; building it here
// keeps the link available after a page reload.
// ============================================================

import type { createAdminClient } from '@/lib/supabase/admin';

type Supabase = ReturnType<typeof createAdminClient>;

const SANDBOX_PAYER_BASE = 'https://www.sandbox.paypal.com/invoice/p/#';
const LIVE_PAYER_BASE = 'https://www.paypal.com/invoice/p/#';

/** Returns the PayPal checkout URL for an invoice. */
export function getInvoicePayerLink(paypalInvoiceId: string): string {
  const base =
    process.env.PAYPAL_ENVIRONMENT === 'production'
      ? LIVE_PAYER_BASE
      : SANDBOX_PAYER_BASE;

  return `${base}${paypalInvoiceId}`;
}

export interface PayableInvoice {
  paypal_invoice_id: string;
  payer_link: string;
  amount: number;
  currency: string;
  status: string;
  /** `invoice` for the original invoice, `installment` for a plan payment. */
  kind: 'invoice' | 'installment';
  installment_number?: number;
}

interface PayableSource {
  id: string;
  status: string;
  paypal_invoice_id: string;
  amount: number;
  currency: string;
}

interface InstallmentSummary {
  number: number;
  amount: number;
  status: string;
  paypal_invoice_id: string | null;
  due_date: string;
}

/**
 * Resolves what the client can actually pay right now.
 *
 * - A live invoice returns itself.
 * - A plan's SUPERSEDED parent returns the current SENT installment, which is
 *   the only PayPal invoice the client should pay.
 * - PAID / CANCELLED invoices and plans with no sent installment return null.
 */
export async function resolvePayableInvoice(
  supabase: Supabase,
  invoice: PayableSource
): Promise<PayableInvoice | null> {
  if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    return null;
  }

  if (invoice.status !== 'SUPERSEDED') {
    return {
      paypal_invoice_id: invoice.paypal_invoice_id,
      payer_link: getInvoicePayerLink(invoice.paypal_invoice_id),
      amount: Number(invoice.amount),
      currency: invoice.currency,
      status: invoice.status,
      kind: 'invoice',
    };
  }

  // The parent was superseded by a plan (or a discount that moved the
  // conversation to a child invoice). Find the live installment.
  const { data: arrangement, error } = await supabase
    .from('arrangements')
    .select('id, installments(number, amount, status, paypal_invoice_id, due_date)')
    .eq('invoice_id', invoice.id)
    .in('status', ['ACCEPTED', 'EXECUTED'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve payable installment: ${error.message}`);
  }

  const installments = (arrangement?.installments ?? []) as InstallmentSummary[];
  const current = installments.find(
    (installment) =>
      installment.status === 'SENT' && installment.paypal_invoice_id
  );

  if (!current?.paypal_invoice_id) {
    return null;
  }

  return {
    paypal_invoice_id: current.paypal_invoice_id,
    payer_link: getInvoicePayerLink(current.paypal_invoice_id),
    amount: Number(current.amount),
    currency: invoice.currency,
    status: current.status,
    kind: 'installment',
    installment_number: current.number,
  };
}
