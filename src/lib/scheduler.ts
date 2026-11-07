// ============================================================
// PulsePay — Installment Scheduler
// Sends each scheduled installment when its due date arrives,
// either on a real schedule or when the demo clock advances.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoNow } from '@/lib/demo-clock';
import { createAndSendInvoice, toSafeDate } from '@/lib/paypal/invoices';
import type { InvoiceRow, InstallmentRow } from '@/types/database';

export interface SchedulerExecutionSummary {
  processed: number;
  sent: number;
  errors: string[];
}

interface ArrangementJoin {
  id: string;
  status: string;
  terms: Record<string, unknown> | null;
  invoice: (InvoiceRow & {
    client?: { name: string; email: string } | null;
    business?: { name: string; currency: string } | null;
  }) | null;
}

interface DueInstallment extends InstallmentRow {
  arrangement: ArrangementJoin | null;
}

function planSize(terms: Record<string, unknown> | null): number | null {
  const installments = terms?.installments;
  return Array.isArray(installments) && installments.length > 0
    ? installments.length
    : null;
}

export async function processDueInstallments(): Promise<SchedulerExecutionSummary> {
  const supabase = createAdminClient();
  const demoNow = await getDemoNow();
  const isoNow = demoNow.toISOString();

  const { data, error } = await supabase
    .from('installments')
    .select(
      '*, arrangement:arrangements(id, status, terms, invoice:invoices(*, client:clients(name, email), business:businesses(name, currency)))'
    )
    .eq('status', 'SCHEDULED')
    .lte('due_date', isoNow);

  if (error) {
    return { processed: 0, sent: 0, errors: [error.message] };
  }

  const dueInstallments = (data ?? []) as DueInstallment[];
  if (dueInstallments.length === 0) {
    return { processed: 0, sent: 0, errors: [] };
  }

  let sent = 0;
  const errors: string[] = [];

  for (const item of dueInstallments) {
    try {
      // Already dispatched (or sent by a previous run that crashed before the
      // status update) — never create a second PayPal invoice.
      if (item.paypal_invoice_id) {
        continue;
      }

      const arrangement = item.arrangement;
      const invoice = arrangement?.invoice;

      if (!arrangement || !invoice) {
        throw new Error('Installment has no arrangement or invoice');
      }

      if (arrangement.status !== 'ACCEPTED' && arrangement.status !== 'EXECUTED') {
        throw new Error(
          `Arrangement ${arrangement.id} is ${arrangement.status}; refusing to send`
        );
      }

      const email = invoice.client?.email?.trim();
      if (!email) {
        throw new Error('Invoice client has no email address');
      }

      const total = planSize(arrangement.terms);
      const description = invoice.description || 'Invoice payment';
      const label = total
        ? `Installment ${item.number} of ${total} — ${description}`
        : `Installment ${item.number} — ${description}`;

      const created = await createAndSendInvoice({
        businessName: invoice.business?.name ?? 'PulsePay',
        clientName: invoice.client?.name ?? 'Client',
        clientEmail: email,
        currency: invoice.currency || 'USD',
        amount: Number(item.amount),
        description: label,
        note: `Installment ${item.number} for PayPal invoice ${invoice.paypal_invoice_id}`,
        dueDate: toSafeDate(item.due_date),
      });

      const { error: updateError } = await supabase
        .from('installments')
        .update({
          status: 'SENT',
          paypal_invoice_id: created.id,
        })
        .eq('id', item.id);

      if (updateError) {
        throw new Error(
          `Sent PayPal invoice ${created.id} but failed to update installment: ${updateError.message}`
        );
      }

      await supabase.from('events').insert({
        type: 'INSTALLMENT_DISPATCHED',
        actor: 'SCHEDULER',
        entity_type: 'installment',
        entity_id: item.id,
        payload: {
          installment_number: item.number,
          amount: Number(item.amount),
          paypal_invoice_id: created.id,
          payer_link: created.payerLink,
        },
      });

      sent++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Installment ${item.id}: ${message}`);
    }
  }

  return {
    processed: dueInstallments.length,
    sent,
    errors,
  };
}
