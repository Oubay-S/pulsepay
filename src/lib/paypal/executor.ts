// ============================================================
// PulsePay — Agreement Executor
// Executes validated proposals into real PayPal actions.
//
// Every invoice is created through the raw Invoicing v2 payload in
// `invoices.ts` so it carries a real recipient, line item and due date.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  cancelPayPalInvoice,
  createEarlyPaymentDiscountRule,
} from './toolkit';
import { createAndSendInvoice, toDateOnly, toSafeDate } from './invoices';
import type { BusinessRow, ClientRow, InvoiceRow } from '@/types/database';
import type {
  DiscountProposal,
  NegotiationProposal,
  PlanProposal,
  ExecutionResult,
} from '@/types/proposals';

type Supabase = ReturnType<typeof createAdminClient>;

interface ExecutionContext {
  supabase: Supabase;
  invoice: InvoiceRow;
  client: ClientRow;
  business: BusinessRow | null;
  currency: string;
  businessName: string;
  clientName: string;
  clientEmail: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function logEvent(
  supabase: Supabase,
  type: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('events').insert({
    type,
    actor: 'AGENT',
    entity_type: entityType,
    entity_id: entityId,
    payload,
  });

  // An audit-log failure must never undo a real PayPal action.
  if (error) {
    console.error(`Failed to write ${type} event:`, error.message);
  }
}

async function loadContext(
  supabase: Supabase,
  invoice: InvoiceRow
): Promise<ExecutionContext> {
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', invoice.client_id)
    .maybeSingle();

  if (clientError) {
    throw new Error(`Failed to load invoice client: ${clientError.message}`);
  }
  if (!client) {
    throw new Error(`Invoice ${invoice.id} has no client record`);
  }
  if (!client.email) {
    throw new Error(
      `Client ${client.name} has no email address; refusing to create a PayPal invoice`
    );
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', invoice.business_id)
    .maybeSingle();

  if (businessError) {
    throw new Error(`Failed to load business: ${businessError.message}`);
  }

  return {
    supabase,
    invoice,
    client,
    business,
    currency: invoice.currency || business?.currency || 'USD',
    businessName: business?.name ?? 'PulsePay',
    clientName: client.name,
    clientEmail: client.email,
  };
}

async function findExistingChildInvoice(
  ctx: ExecutionContext
): Promise<InvoiceRow | null> {
  const { data, error } = await ctx.supabase
    .from('invoices')
    .select('*')
    .eq('parent_invoice_id', ctx.invoice.paypal_invoice_id)
    .neq('status', 'CANCELLED')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to check for an existing reissued invoice: ${error.message}`);
  }

  return (data?.[0] as InvoiceRow | undefined) ?? null;
}

async function cancelOriginalInvoice(
  ctx: ExecutionContext,
  reason: string
): Promise<string | undefined> {
  try {
    await cancelPayPalInvoice(ctx.invoice.paypal_invoice_id, reason);
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The replacement invoice is already live. Surface the warning instead of
    // hiding it, but do not strand the client without a payable invoice.
    await logEvent(ctx.supabase, 'ORIGINAL_INVOICE_CANCEL_FAILED', 'invoice', ctx.invoice.id, {
      paypal_invoice_id: ctx.invoice.paypal_invoice_id,
      error: message,
    });
    return message;
  }
}

// ------------------------------------------------------------
// Discount
// ------------------------------------------------------------

async function executeDiscount(
  ctx: ExecutionContext,
  proposal: DiscountProposal
): Promise<ExecutionResult> {
  const { invoice } = ctx;
  const percent = proposal.discount_pct;
  const discountedAmount = round2(invoice.amount * (1 - percent / 100));

  if (discountedAmount <= 0) {
    throw new Error(`A ${percent}% discount leaves no payable amount`);
  }

  // Retried accepts must return the invoice that already exists.
  const existingChild = await findExistingChildInvoice(ctx);
  if (existingChild) {
    return {
      success: true,
      action: 'VOID_AND_REISSUE_DISCOUNT',
      paypal_ids: [existingChild.paypal_invoice_id],
      details: {
        newInvoiceId: existingChild.paypal_invoice_id,
        amount: Number(existingChild.amount),
        reused: true,
      },
    };
  }

  if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    throw new Error(`Cannot reissue an invoice that is already ${invoice.status}`);
  }

  const deadline = new Date(Date.now() + proposal.deadline_hours * 3_600_000);
  const dueDate = toDateOnly(deadline);
  const description = invoice.description || 'Invoice payment';

  // 1. Try PayPal's native early-payment discount rule first.
  try {
    await createEarlyPaymentDiscountRule(invoice.paypal_invoice_id, percent, dueDate);

    await logEvent(ctx.supabase, 'DISCOUNT_RULE_CREATED', 'invoice', invoice.id, {
      paypal_invoice_id: invoice.paypal_invoice_id,
      discount_pct: percent,
      deadline,
    });

    return {
      success: true,
      action: 'EARLY_PAYMENT_DISCOUNT_RULE',
      paypal_ids: [invoice.paypal_invoice_id],
      details: {
        invoiceId: invoice.paypal_invoice_id,
        discount_pct: percent,
        original_amount: invoice.amount,
        discounted_amount: discountedAmount,
        deadline: deadline.toISOString(),
      },
    };
  } catch (ruleError) {
    const message = ruleError instanceof Error ? ruleError.message : String(ruleError);
    await logEvent(ctx.supabase, 'DISCOUNT_RULE_FALLBACK', 'invoice', invoice.id, {
      paypal_invoice_id: invoice.paypal_invoice_id,
      error: message,
      fallback: 'VOID_AND_REISSUE',
    });
  }

  // 2. Void & reissue fallback.
  const reissued = await createAndSendInvoice({
    businessName: ctx.businessName,
    clientName: ctx.clientName,
    clientEmail: ctx.clientEmail,
    currency: ctx.currency,
    amount: discountedAmount,
    description: `${description} (${percent}% early-payment discount)`,
    note: `Discounted invoice for original PayPal invoice ${invoice.paypal_invoice_id}`,
    dueDate: deadline,
  });

  const cancelWarning = await cancelOriginalInvoice(
    ctx,
    `Superseded by early-payment agreement: ${percent}% discount if paid within ${proposal.deadline_hours}h`
  );

  // 3. Persist the new invoice before marking the original superseded.
  const { data: child, error: childError } = await ctx.supabase
    .from('invoices')
    .insert({
      business_id: invoice.business_id,
      client_id: invoice.client_id,
      paypal_invoice_id: reissued.id,
      parent_invoice_id: invoice.paypal_invoice_id,
      amount: discountedAmount,
      currency: ctx.currency,
      due_date: deadline.toISOString(),
      status: 'SENT',
      priority_score: 0,
      priority_reason: 'Active early-payment discount arrangement',
      description,
    })
    .select()
    .single();

  if (childError) {
    throw new Error(`Created PayPal invoice ${reissued.id} but failed to save it: ${childError.message}`);
  }

  const { error: supersedeError } = await ctx.supabase
    .from('invoices')
    .update({ status: 'SUPERSEDED' })
    .eq('id', invoice.id);

  if (supersedeError) {
    throw new Error(`Failed to mark original invoice superseded: ${supersedeError.message}`);
  }

  // Keep the client's existing conversation token pointed at the live invoice.
  await ctx.supabase
    .from('conversations')
    .update({ invoice_id: child.id })
    .eq('invoice_id', invoice.id);

  await logEvent(ctx.supabase, 'ARRANGEMENT_EXECUTED', 'invoice', invoice.id, {
    type: 'discount',
    original_invoice_id: invoice.paypal_invoice_id,
    new_invoice_id: reissued.id,
    original_amount: invoice.amount,
    discount_pct: percent,
    discounted_amount: discountedAmount,
    deadline: deadline.toISOString(),
    payer_link: reissued.payerLink,
    ...(cancelWarning ? { cancel_warning: cancelWarning } : {}),
  });

  return {
    success: true,
    action: 'VOID_AND_REISSUE_DISCOUNT',
    paypal_ids: [reissued.id],
    details: {
      newInvoiceId: reissued.id,
      originalInvoiceId: invoice.paypal_invoice_id,
      amount: discountedAmount,
      deadline: deadline.toISOString(),
      payerLink: reissued.payerLink,
      ...(cancelWarning ? { warning: cancelWarning } : {}),
    },
  };
}

// ------------------------------------------------------------
// Installment plan
// ------------------------------------------------------------

async function executePlan(
  ctx: ExecutionContext,
  proposal: PlanProposal,
  arrangementId?: string
): Promise<ExecutionResult> {
  const { invoice } = ctx;
  const installments = [...proposal.installments].sort((a, b) => a.number - b.number);

  if (installments.length === 0) {
    throw new Error('An installment plan must contain at least one installment');
  }

  // Retried accepts must not duplicate the schedule.
  if (arrangementId) {
    const { data: existing, error } = await ctx.supabase
      .from('installments')
      .select('id, number, paypal_invoice_id, status')
      .eq('arrangement_id', arrangementId)
      .order('number', { ascending: true });

    if (error) {
      throw new Error(`Failed to check existing installments: ${error.message}`);
    }

    if (existing && existing.length > 0) {
      const firstSent = existing.find((row) => row.paypal_invoice_id);
      return {
        success: true,
        action: 'STAGED_INSTALLMENTS_STARTED',
        paypal_ids: firstSent?.paypal_invoice_id ? [firstSent.paypal_invoice_id] : [],
        details: {
          reused: true,
          totalInstallments: existing.length,
          installment1Id: firstSent?.paypal_invoice_id ?? null,
        },
      };
    }
  }

  if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    throw new Error(`Cannot start a plan on an invoice that is already ${invoice.status}`);
  }

  const total = installments.length;
  const first = installments[0];
  const description = invoice.description || 'Invoice payment';

  const firstInvoice = await createAndSendInvoice({
    businessName: ctx.businessName,
    clientName: ctx.clientName,
    clientEmail: ctx.clientEmail,
    currency: ctx.currency,
    amount: Number(first.amount),
    description: `Installment 1 of ${total} — ${description}`,
    note: `Installment plan for PayPal invoice ${invoice.paypal_invoice_id}`,
    dueDate: toSafeDate(first.due_date),
  });

  const cancelWarning = await cancelOriginalInvoice(
    ctx,
    `Superseded by installment plan: ${total} payments`
  );

  const { error: supersedeError } = await ctx.supabase
    .from('invoices')
    .update({ status: 'SUPERSEDED' })
    .eq('id', invoice.id);

  if (supersedeError) {
    throw new Error(`Failed to mark original invoice superseded: ${supersedeError.message}`);
  }

  if (arrangementId) {
    const rows = installments.map((installment, index) => ({
      arrangement_id: arrangementId,
      number: installment.number,
      amount: Number(installment.amount),
      due_date: installment.due_date,
      paypal_invoice_id: index === 0 ? firstInvoice.id : null,
      status: index === 0 ? ('SENT' as const) : ('SCHEDULED' as const),
    }));

    const { error: insertError } = await ctx.supabase
      .from('installments')
      .insert(rows);

    if (insertError) {
      throw new Error(`Failed to save installment schedule: ${insertError.message}`);
    }
  }

  await logEvent(ctx.supabase, 'ARRANGEMENT_EXECUTED', 'invoice', invoice.id, {
    type: 'plan',
    original_invoice_id: invoice.paypal_invoice_id,
    installment_1_paypal_id: firstInvoice.id,
    total_installments: total,
    payer_link: firstInvoice.payerLink,
    ...(cancelWarning ? { cancel_warning: cancelWarning } : {}),
  });

  return {
    success: true,
    action: 'STAGED_INSTALLMENTS_STARTED',
    paypal_ids: [firstInvoice.id],
    details: {
      installment1Id: firstInvoice.id,
      totalInstallments: total,
      payerLink: firstInvoice.payerLink,
      ...(cancelWarning ? { warning: cancelWarning } : {}),
    },
  };
}

// ------------------------------------------------------------
// Pay Later
// ------------------------------------------------------------

async function executePayLater(
  ctx: ExecutionContext,
  invoiceAmount: number
): Promise<ExecutionResult> {
  await logEvent(ctx.supabase, 'PAY_LATER_REQUESTED', 'invoice', ctx.invoice.id, {
    invoice_amount: invoiceAmount,
    paypal_invoice_id: ctx.invoice.paypal_invoice_id,
  });

  // The Orders v2 order + capture routes arrive in Phase 3. No PayPal object is
  // created here, so we must not report a new PayPal ID.
  return {
    success: true,
    action: 'PAY_LATER_READY',
    paypal_ids: [],
    details: {
      invoiceAmount,
      invoiceId: ctx.invoice.paypal_invoice_id,
      orderCreated: false,
    },
  };
}

// ------------------------------------------------------------
// Entry point
// ------------------------------------------------------------

export async function executeAgreement(
  proposal: NegotiationProposal,
  invoice: InvoiceRow,
  arrangementId?: string
): Promise<ExecutionResult> {
  const supabase = createAdminClient();

  try {
    const ctx = await loadContext(supabase, invoice);

    if (proposal.type === 'discount') {
      return await executeDiscount(ctx, proposal);
    }

    if (proposal.type === 'plan') {
      return await executePlan(ctx, proposal, arrangementId);
    }

    if (proposal.type === 'pay_later') {
      return await executePayLater(ctx, proposal.invoice_amount);
    }

    return {
      success: false,
      error: `Unknown proposal type: ${(proposal as { type?: string }).type ?? 'undefined'}`,
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
