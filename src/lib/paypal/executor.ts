// ============================================================
// PulsePay — Agreement Executor
// Executes validated proposals into real PayPal actions
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  cancelPayPalInvoice,
  createPayPalInvoice,
  sendPayPalInvoice,
  recordPayPalPayment,
} from './toolkit';
import type { InvoiceRow } from '@/types/database';
import type {
  NegotiationProposal,
  ExecutionResult,
} from '@/types/proposals';

export async function executeAgreement(
  proposal: NegotiationProposal,
  invoice: InvoiceRow,
  arrangementId?: string
): Promise<ExecutionResult> {
  const supabase = createAdminClient();

  try {
    if (proposal.type === 'discount') {
      const discountedAmount = invoice.amount * (1 - proposal.discount_pct / 100);
      const roundedAmount = Math.round(discountedAmount * 100) / 100;

      // Void & Reissue flow
      // 1. Cancel original invoice in PayPal
      await cancelPayPalInvoice(
        invoice.paypal_invoice_id,
        `Superseded by early payment agreement: ${proposal.discount_pct}% discount if paid within ${proposal.deadline_hours}h`
      );

      // 2. Create new discounted invoice in PayPal
      const newInvoice = await createPayPalInvoice({
        detail: {
          currency_code: invoice.currency || 'USD',
          note: `Discounted invoice (Original: ${invoice.paypal_invoice_id})`,
        },
        amount: {
          currency_code: invoice.currency || 'USD',
          value: roundedAmount.toFixed(2),
        },
      });

      // 3. Send new invoice
      await sendPayPalInvoice(newInvoice.id);

      // 4. Update database
      await supabase
        .from('invoices')
        .update({ status: 'SUPERSEDED' })
        .eq('id', invoice.id);

      const { data: insertedNewInv } = await supabase
        .from('invoices')
        .insert({
          business_id: invoice.business_id,
          client_id: invoice.client_id,
          paypal_invoice_id: newInvoice.id,
          parent_invoice_id: invoice.paypal_invoice_id,
          amount: roundedAmount,
          currency: invoice.currency,
          due_date: new Date(Date.now() + proposal.deadline_hours * 3600 * 1000).toISOString(),
          status: 'SENT',
          priority_score: 5,
          priority_reason: 'Active discount arrangement applied',
        })
        .select()
        .single();

      // Log event
      await supabase.from('events').insert({
        type: 'ARRANGEMENT_EXECUTED',
        actor: 'AGENT',
        entity_type: 'invoice',
        entity_id: invoice.id,
        payload: {
          type: 'discount',
          new_invoice_id: newInvoice.id,
          discounted_amount: roundedAmount,
        },
      });

      return {
        success: true,
        action: 'VOID_AND_REISSUE_DISCOUNT',
        paypal_ids: [newInvoice.id],
        details: { newInvoiceId: newInvoice.id, amount: roundedAmount },
      };
    }

    if (proposal.type === 'plan') {
      const installments = proposal.installments;
      const first = installments[0];

      // 1. Cancel original invoice in PayPal
      await cancelPayPalInvoice(
        invoice.paypal_invoice_id,
        `Superseded by installment plan: ${installments.length} payments`
      );

      // 2. Create & send Installment 1 now
      const inst1Paypal = await createPayPalInvoice({
        detail: {
          currency_code: invoice.currency || 'USD',
          note: `Installment 1 of ${installments.length} for original invoice #${invoice.paypal_invoice_id}`,
        },
        amount: {
          currency_code: invoice.currency || 'USD',
          value: first.amount.toFixed(2),
        },
      });

      await sendPayPalInvoice(inst1Paypal.id);

      // 3. Update original invoice status in DB
      await supabase
        .from('invoices')
        .update({ status: 'SUPERSEDED' })
        .eq('id', invoice.id);

      // 4. Record all installments in DB
      if (arrangementId) {
        const installmentRows = installments.map((inst, index) => ({
          arrangement_id: arrangementId,
          number: inst.number,
          amount: inst.amount,
          due_date: inst.due_date,
          paypal_invoice_id: index === 0 ? inst1Paypal.id : null,
          status: index === 0 ? ('SENT' as const) : ('SCHEDULED' as const),
        }));

        await supabase.from('installments').insert(installmentRows);
      }

      // Log event
      await supabase.from('events').insert({
        type: 'ARRANGEMENT_EXECUTED',
        actor: 'AGENT',
        entity_type: 'invoice',
        entity_id: invoice.id,
        payload: {
          type: 'plan',
          installment_1_paypal_id: inst1Paypal.id,
          total_installments: installments.length,
        },
      });

      return {
        success: true,
        action: 'STAGED_INSTALLMENTS_STARTED',
        paypal_ids: [inst1Paypal.id],
        details: { installment1Id: inst1Paypal.id, totalInstallments: installments.length },
      };
    }

    if (proposal.type === 'pay_later') {
      // Pay Later is presented directly on checkout via PayPal JS SDK
      // When captured, payment webhook triggers recordPayPalPayment
      return {
        success: true,
        action: 'PAY_LATER_READY',
        paypal_ids: [invoice.paypal_invoice_id],
        details: { invoiceAmount: proposal.invoice_amount },
      };
    }

    return {
      success: false,
      error: 'Unknown proposal type',
      action: 'NONE',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      action: 'FAILED',
    };
  }
}

