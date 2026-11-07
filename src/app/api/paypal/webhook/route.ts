import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/paypal/webhooks';
import type { PayPalWebhookEvent } from '@/types/paypal';
import type { InvoiceStatus } from '@/types/database';

type Supabase = ReturnType<typeof createAdminClient>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Invoice events carry the invoice at `resource`; some payload variants nest
 * it under `resource.invoice`. Accept both.
 */
function extractInvoiceId(resource: Record<string, unknown>): string | undefined {
  return asString(resource.id) ?? asString(asRecord(resource.invoice).id);
}

/**
 * Maps a PayPal invoice status onto the DB status enum.
 *
 * REFUNDED has no DB value until migration 002 lands, so refunds map to
 * PARTIALLY_PAID for now.
 */
function mapPayPalStatus(status: string | undefined): InvoiceStatus | null {
  switch (status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'SENT':
    case 'UNPAID':
      return 'SENT';
    case 'PAID':
    case 'MARKED_AS_PAID':
      return 'PAID';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'PARTIALLY_PAID':
    case 'PARTIALLY_REFUNDED':
    case 'REFUNDED':
      return 'PARTIALLY_PAID';
    default:
      return null;
  }
}

async function logWebhookEvent(
  supabase: Supabase,
  event: PayPalWebhookEvent,
  type: string,
  payload: Record<string, unknown>,
  entity?: { type: string; id: string | null }
): Promise<void> {
  const { error } = await supabase.from('events').insert({
    type,
    actor: 'PAYPAL',
    entity_type: entity?.type ?? 'paypal_webhook',
    entity_id: entity?.id ?? null,
    payload: {
      event_id: event.id,
      event_type: event.event_type,
      summary: event.summary,
      resource_type: event.resource_type,
      ...payload,
    },
  });

  if (error) {
    throw new Error(`Failed to write ${type} event: ${error.message}`);
  }
}

async function maybeCompletePlan(
  supabase: Supabase,
  arrangementId: string
): Promise<void> {
  const { data: rows, error } = await supabase
    .from('installments')
    .select('status')
    .eq('arrangement_id', arrangementId);

  if (error) {
    throw new Error(`Failed to check installment plan: ${error.message}`);
  }

  if (!rows || rows.length === 0 || !rows.every((row) => row.status === 'PAID')) {
    return;
  }

  const { error: arrangementError } = await supabase
    .from('arrangements')
    .update({ status: 'EXECUTED', updated_at: new Date().toISOString() })
    .eq('id', arrangementId);

  if (arrangementError) {
    throw new Error(`Failed to mark arrangement executed: ${arrangementError.message}`);
  }

  const { data: arrangement, error: fetchError } = await supabase
    .from('arrangements')
    .select('invoice_id')
    .eq('id', arrangementId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load arrangement invoice: ${fetchError.message}`);
  }

  if (arrangement?.invoice_id) {
    await supabase
      .from('conversations')
      .update({ status: 'RESOLVED' })
      .eq('invoice_id', arrangement.invoice_id);
  }
}

/**
 * Marks an invoice (or one of its installments) paid and resolves the plan
 * when the last installment clears.
 *
 * PayPal sends `INVOICING.INVOICE.PAID` for partial payments too, so the
 * caller classifies the payment as `full` or `partial` from the resource
 * status/amounts. A partial payment must never resolve a conversation or
 * close an installment.
 */
async function markPaypalInvoicePaid(
  supabase: Supabase,
  paypalInvoiceId: string,
  event: PayPalWebhookEvent,
  mode: 'full' | 'partial' = 'full'
): Promise<void> {
  const paidAt = new Date().toISOString();
  const isPartial = mode === 'partial';

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, amount, currency, status')
    .eq('paypal_invoice_id', paypalInvoiceId)
    .maybeSingle();

  if (invoiceError) {
    throw new Error(`Failed to load invoice ${paypalInvoiceId}: ${invoiceError.message}`);
  }

  if (invoice && !isPartial && invoice.status !== 'PAID') {
    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'PAID',
        priority_score: 0,
        priority_reason: 'Paid via PayPal',
        synced_at: paidAt,
      })
      .eq('id', invoice.id);

    if (error) {
      throw new Error(`Failed to mark invoice ${paypalInvoiceId} paid: ${error.message}`);
    }
  }

  if (
    invoice &&
    isPartial &&
    invoice.status !== 'PAID' &&
    invoice.status !== 'SUPERSEDED'
  ) {
    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'PARTIALLY_PAID',
        priority_reason: 'Partially paid via PayPal',
        synced_at: paidAt,
      })
      .eq('id', invoice.id);

    if (error) {
      throw new Error(
        `Failed to mark invoice ${paypalInvoiceId} partially paid: ${error.message}`
      );
    }
  }

  const { data: installment, error: installmentError } = await supabase
    .from('installments')
    .select('id, arrangement_id, number')
    .eq('paypal_invoice_id', paypalInvoiceId)
    .maybeSingle();

  if (installmentError) {
    throw new Error(
      `Failed to load installment ${paypalInvoiceId}: ${installmentError.message}`
    );
  }

  if (installment && !isPartial) {
    const { error } = await supabase
      .from('installments')
      .update({ status: 'PAID', paid_at: paidAt })
      .eq('id', installment.id);

    if (error) {
      throw new Error(
        `Failed to mark installment ${installment.id} paid: ${error.message}`
      );
    }

    await maybeCompletePlan(supabase, installment.arrangement_id);
  }

  if (invoice && !isPartial) {
    await supabase
      .from('conversations')
      .update({ status: 'RESOLVED' })
      .eq('invoice_id', invoice.id);
  }

  const matched = Boolean(invoice || installment);

  await logWebhookEvent(
    supabase,
    event,
    !matched
      ? 'PAYMENT_RECEIVED_UNMATCHED'
      : isPartial
        ? 'PAYMENT_PARTIALLY_RECEIVED'
        : 'PAYMENT_RECEIVED',
    {
      paypal_invoice_id: paypalInvoiceId,
      invoice_id: invoice?.id ?? null,
      installment_id: installment?.id ?? null,
      amount: invoice?.amount ?? null,
      currency: invoice?.currency ?? null,
      mode,
      resource_status: asString(asRecord(event.resource).status) ?? null,
    },
    invoice
      ? { type: 'invoice', id: invoice.id }
      : installment
        ? { type: 'installment', id: installment.id }
        : undefined
  );
}

async function handleInvoicePaid(
  supabase: Supabase,
  event: PayPalWebhookEvent
): Promise<void> {
  const resource = asRecord(event.resource);
  const paypalInvoiceId = extractInvoiceId(resource);

  if (!paypalInvoiceId) {
    await logWebhookEvent(supabase, event, 'PAYMENT_RECEIVED_UNMATCHED', {
      note: 'INVOICING.INVOICE.PAID payload had no resource.id',
    });
    return;
  }

  // PayPal fires INVOICING.INVOICE.PAID for partial payments as well. Trust
  // the resource status first, then fall back to comparing paid vs total.
  const resourceStatus = asString(resource.status);
  const paidAmount = Number(
    asString(asRecord(asRecord(resource.payments).paid_amount).value)
  );
  const totalAmount = Number(asString(asRecord(resource.amount).value));

  const isPartial =
    resourceStatus === 'PARTIALLY_PAID' ||
    resourceStatus === 'PARTIALLY_REFUNDED' ||
    (Number.isFinite(paidAmount) &&
      Number.isFinite(totalAmount) &&
      paidAmount > 0 &&
      paidAmount < totalAmount);

  await markPaypalInvoicePaid(
    supabase,
    paypalInvoiceId,
    event,
    isPartial ? 'partial' : 'full'
  );
}

async function handleInvoiceCancelled(
  supabase: Supabase,
  event: PayPalWebhookEvent
): Promise<void> {
  const resource = asRecord(event.resource);
  const paypalInvoiceId = extractInvoiceId(resource);

  let entityId: string | null = null;

  if (paypalInvoiceId) {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('paypal_invoice_id', paypalInvoiceId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load cancelled invoice: ${error.message}`);
    }

    if (invoice) {
      entityId = invoice.id;

      // SUPERSEDED is PulsePay's record of why the invoice was cancelled
      // (discount or plan). PayPal's CANCELLED must not overwrite it.
      if (invoice.status !== 'SUPERSEDED') {
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ status: 'CANCELLED', synced_at: new Date().toISOString() })
          .eq('id', invoice.id);

        if (updateError) {
          throw new Error(`Failed to mark invoice cancelled: ${updateError.message}`);
        }
      }
    }
  }

  await logWebhookEvent(
    supabase,
    event,
    'INVOICE_CANCELLED',
    { paypal_invoice_id: paypalInvoiceId ?? null },
    entityId ? { type: 'invoice', id: entityId } : undefined
  );
}

async function handleInvoiceRefunded(
  supabase: Supabase,
  event: PayPalWebhookEvent
): Promise<void> {
  const resource = asRecord(event.resource);
  const paypalInvoiceId = extractInvoiceId(resource);

  let entityId: string | null = null;

  if (paypalInvoiceId) {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id')
      .eq('paypal_invoice_id', paypalInvoiceId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load refunded invoice: ${error.message}`);
    }

    if (invoice) {
      entityId = invoice.id;
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          // REFUNDED lands with migration 002; PARTIALLY_PAID keeps the
          // current check constraint valid in the meantime.
          status: 'PARTIALLY_PAID',
          priority_reason: 'Refunded in PayPal',
          synced_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (updateError) {
        throw new Error(`Failed to mark invoice refunded: ${updateError.message}`);
      }
    }
  }

  await logWebhookEvent(
    supabase,
    event,
    'INVOICE_REFUNDED',
    { paypal_invoice_id: paypalInvoiceId ?? null },
    entityId ? { type: 'invoice', id: entityId } : undefined
  );
}

async function handleInvoiceUpdated(
  supabase: Supabase,
  event: PayPalWebhookEvent
): Promise<void> {
  const resource = asRecord(event.resource);
  const paypalInvoiceId = extractInvoiceId(resource);

  if (!paypalInvoiceId) {
    await logWebhookEvent(supabase, event, 'INVOICE_UPDATED', {
      note: 'payload had no resource.id',
    });
    return;
  }

  const { data: existing, error } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('paypal_invoice_id', paypalInvoiceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load updated invoice: ${error.message}`);
  }

  if (!existing) {
    await logWebhookEvent(supabase, event, 'INVOICE_UPDATED', {
      paypal_invoice_id: paypalInvoiceId,
      note: 'Invoice is not tracked in PulsePay',
    });
    return;
  }

  const detail = asRecord(resource.detail);
  const amount = asRecord(resource.amount);
  const dueAmount = asRecord(resource.due_amount);
  const paymentTerm = asRecord(detail.payment_term);

  const updates: Record<string, unknown> = {
    synced_at: new Date().toISOString(),
  };

  const mappedStatus = mapPayPalStatus(asString(resource.status));
  if (
    mappedStatus &&
    existing.status !== 'PAID' &&
    existing.status !== 'SUPERSEDED'
  ) {
    updates.status = mappedStatus;
  }

  const amountValue = asString(amount.value) ?? asString(dueAmount.value);
  if (amountValue) {
    updates.amount = Number.parseFloat(amountValue);
  }

  const currency = asString(amount.currency_code) ?? asString(detail.currency_code);
  if (currency) {
    updates.currency = currency;
  }

  const dueDate = asString(paymentTerm.due_date) ?? asString(detail.invoice_date);
  if (dueDate) {
    const parsed = new Date(dueDate);
    if (!Number.isNaN(parsed.getTime())) {
      updates.due_date = parsed.toISOString();
    }
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', existing.id);

  if (updateError) {
    throw new Error(`Failed to apply invoice update: ${updateError.message}`);
  }

  await logWebhookEvent(
    supabase,
    event,
    'INVOICE_UPDATED',
    { paypal_invoice_id: paypalInvoiceId, updates },
    { type: 'invoice', id: existing.id }
  );
}

async function resolveInvoiceByCustomId(
  supabase: Supabase,
  customId: string | undefined
): Promise<{ id: string; paypal_invoice_id: string } | null> {
  if (!customId || !UUID_RE.test(customId)) {
    return null;
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('id, paypal_invoice_id')
    .eq('id', customId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve invoice ${customId}: ${error.message}`);
  }

  return data ?? null;
}

async function handleCaptureCompleted(
  supabase: Supabase,
  event: PayPalWebhookEvent
): Promise<void> {
  const resource = asRecord(event.resource);
  const customId = asString(resource.custom_id);
  const orderId = asString(
    asRecord(asRecord(resource.supplementary_data).related_ids).order_id
  );
  const captureId = asString(resource.id);

  const invoice = await resolveInvoiceByCustomId(supabase, customId);

  if (!invoice) {
    // A capture ID is not an invoice ID. Until `paypal_order_id` exists
    // (migration 002), an unmappable capture is logged, never guessed.
    await logWebhookEvent(supabase, event, 'PAYMENT_CAPTURE_UNMAPPED', {
      capture_id: captureId ?? null,
      order_id: orderId ?? null,
      custom_id: customId ?? null,
    });
    return;
  }

  await markPaypalInvoicePaid(supabase, invoice.paypal_invoice_id, event);
}

async function handleCaptureDenied(
  supabase: Supabase,
  event: PayPalWebhookEvent
): Promise<void> {
  const resource = asRecord(event.resource);

  await logWebhookEvent(supabase, event, 'PAYMENT_DENIED', {
    capture_id: asString(resource.id) ?? null,
    custom_id: asString(resource.custom_id) ?? null,
  });
}

async function handleCaptureRefunded(
  supabase: Supabase,
  event: PayPalWebhookEvent
): Promise<void> {
  const resource = asRecord(event.resource);
  const invoice = await resolveInvoiceByCustomId(
    supabase,
    asString(resource.custom_id)
  );

  if (invoice) {
    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'PARTIALLY_PAID',
        priority_reason: 'Refunded in PayPal',
        synced_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (error) {
      throw new Error(`Failed to mark capture refund: ${error.message}`);
    }
  }

  await logWebhookEvent(
    supabase,
    event,
    'PAYMENT_REFUNDED',
    {
      capture_id: asString(resource.id) ?? null,
      custom_id: asString(resource.custom_id) ?? null,
      invoice_id: invoice?.id ?? null,
    },
    invoice ? { type: 'invoice', id: invoice.id } : undefined
  );
}

async function handleEvent(
  supabase: Supabase,
  event: PayPalWebhookEvent
): Promise<void> {
  switch (event.event_type) {
    case 'INVOICING.INVOICE.PAID':
      await handleInvoicePaid(supabase, event);
      break;
    case 'INVOICING.INVOICE.CANCELLED':
      await handleInvoiceCancelled(supabase, event);
      break;
    case 'INVOICING.INVOICE.REFUNDED':
      await handleInvoiceRefunded(supabase, event);
      break;
    case 'INVOICING.INVOICE.UPDATED':
      await handleInvoiceUpdated(supabase, event);
      break;
    case 'PAYMENT.CAPTURE.COMPLETED':
      await handleCaptureCompleted(supabase, event);
      break;
    case 'PAYMENT.CAPTURE.DENIED':
      await handleCaptureDenied(supabase, event);
      break;
    case 'PAYMENT.CAPTURE.REFUNDED':
      await handleCaptureRefunded(supabase, event);
      break;
    default:
      await logWebhookEvent(supabase, event, 'WEBHOOK_IGNORED', {
        note: 'Unhandled event type',
      });
  }
}

export async function POST(req: NextRequest) {
  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Could not read request body' }, { status: 400 });
  }

  // 1. Cryptographic verification happens before any database write.
  const isValid = await verifyWebhookSignature(req.headers, rawBody);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PayPalWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const eventId = event.id;
  const eventType = event.event_type;

  if (!eventId || !eventType) {
    return NextResponse.json(
      { error: 'Webhook payload is missing id or event_type' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 2. Atomic dedupe: the primary key decides the winner, not a pre-check.
  const { error: insertError } = await supabase.from('processed_events').insert({
    paypal_event_id: eventId,
    event_type: eventType,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({
        received: true,
        duplicate: true,
        event_id: eventId,
      });
    }

    return NextResponse.json(
      { error: `Failed to record webhook event: ${insertError.message}` },
      { status: 500 }
    );
  }

  try {
    await handleEvent(supabase, event);
  } catch (err: unknown) {
    // Remove the marker so PayPal's retry is actually processed.
    await supabase
      .from('processed_events')
      .delete()
      .eq('paypal_event_id', eventId);

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    received: true,
    event_type: eventType,
    event_id: eventId,
  });
}
