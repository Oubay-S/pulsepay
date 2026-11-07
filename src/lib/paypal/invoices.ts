// ============================================================
// PulsePay — PayPal Invoice Drafts
// Builds complete Invoicing v2 payloads and sends them.
//
// The Agent Toolkit's flat `create_invoice` cannot set
// `detail.payment_term.due_date`, so every PulsePay invoice goes
// through raw REST with the full nested payload.
// ============================================================

import { createPayPalInvoice, sendPayPalInvoiceWithLink } from './toolkit';

export interface InvoiceDraft {
  businessName: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  amount: number;
  description: string;
  note?: string;
  invoiceDate?: Date;
  dueDate?: Date;
}

export interface CreatedInvoice {
  id: string;
  payerLink?: string;
}

/** Splits a display name into PayPal's given_name / surname pair. */
export function splitName(fullName: string): { givenName: string; surname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { givenName: 'Client', surname: '' };
  }
  if (parts.length === 1) {
    return { givenName: parts[0], surname: '' };
  }

  return {
    givenName: parts[0],
    surname: parts.slice(1).join(' '),
  };
}

/** Formats a Date as the yyyy-MM-dd string PayPal expects. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Formats a Date as an ISO date-time, falling back to now on bad input. */
export function toSafeDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Builds a complete Invoicing v2 create payload.
 *
 * Throws when the client has no email: PulsePay never invents recipients.
 */
export function buildInvoicePayload(draft: InvoiceDraft): Record<string, unknown> {
  const email = draft.clientEmail?.trim();
  if (!email) {
    throw new Error('Cannot create a PayPal invoice without a client email address');
  }

  if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    throw new Error(`Invalid invoice amount: ${draft.amount}`);
  }

  const currency = draft.currency || 'USD';
  const invoiceDate = draft.invoiceDate ?? new Date();
  const dueDate = draft.dueDate ?? invoiceDate;
  const { givenName, surname } = splitName(draft.clientName);
  const note = draft.note?.slice(0, 200);

  return {
    detail: {
      currency_code: currency,
      invoice_date: toDateOnly(invoiceDate),
      ...(note ? { note } : {}),
      payment_term: {
        due_date: toDateOnly(dueDate),
      },
    },
    invoicer: {
      business_name: draft.businessName,
    },
    primary_recipients: [
      {
        billing_info: {
          email_address: email,
          name: {
            given_name: givenName,
            ...(surname ? { surname } : {}),
          },
        },
      },
    ],
    items: [
      {
        name: draft.description.slice(0, 200),
        description: (draft.note ?? draft.description).slice(0, 200),
        quantity: '1',
        unit_amount: {
          currency_code: currency,
          value: draft.amount.toFixed(2),
        },
      },
    ],
  };
}

/**
 * Creates and sends an invoice in one step, returning the real PayPal ID and
 * the payer link from the send response.
 */
export async function createAndSendInvoice(
  draft: InvoiceDraft
): Promise<CreatedInvoice> {
  const payload = buildInvoicePayload(draft);
  const created = await createPayPalInvoice(payload);
  const sent = await sendPayPalInvoiceWithLink(created.id);

  return {
    id: created.id,
    payerLink: sent.payerLink,
  };
}
