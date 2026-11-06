// ============================================================
// PulsePay — Installment Scheduler
// Processes due installments on real schedule or demo clock advance
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoNow } from '@/lib/demo-clock';
import { createPayPalInvoice, sendPayPalInvoice } from '@/lib/paypal/toolkit';
import type { InstallmentRow } from '@/types/database';

export interface SchedulerExecutionSummary {
  processed: number;
  sent: number;
  errors: string[];
}

export async function processDueInstallments(): Promise<SchedulerExecutionSummary> {
  const supabase = createAdminClient();
  const demoNow = await getDemoNow();
  const isoNow = demoNow.toISOString();

  // Find all scheduled installments that are now due
  const { data: dueInstallments, error } = await supabase
    .from('installments')
    .select('*, arrangement:arrangements(invoice:invoices(*))')
    .eq('status', 'SCHEDULED')
    .lte('due_date', isoNow);

  if (error || !dueInstallments || dueInstallments.length === 0) {
    return { processed: 0, sent: 0, errors: error ? [error.message] : [] };
  }

  let sent = 0;
  const errors: string[] = [];

  for (const item of dueInstallments) {
    try {
      const arrangement = item.arrangement;
      const invoice = arrangement?.invoice;
      const currency = invoice?.currency || 'USD';

      // Create PayPal invoice for this installment
      const newInvoice = await createPayPalInvoice({
        detail: {
          currency_code: currency,
          note: `Installment #${item.number} for agreement #${item.arrangement_id}`,
        },
        amount: {
          currency_code: currency,
          value: Number(item.amount).toFixed(2),
        },
      });

      // Send the invoice
      await sendPayPalInvoice(newInvoice.id);

      // Update installment record
      await supabase
        .from('installments')
        .update({
          status: 'SENT',
          paypal_invoice_id: newInvoice.id,
        })
        .eq('id', item.id);

      // Record audit event
      await supabase.from('events').insert({
        type: 'INSTALLMENT_DISPATCHED',
        actor: 'SCHEDULER',
        entity_type: 'installment',
        entity_id: item.id,
        payload: {
          installment_number: item.number,
          amount: item.amount,
          paypal_invoice_id: newInvoice.id,
        },
      });

      sent++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Installment ${item.id}: ${msg}`);
    }
  }

  return {
    processed: dueInstallments.length,
    sent,
    errors,
  };
}

