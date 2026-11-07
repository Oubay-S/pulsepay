// ============================================================
// PulsePay — Pay Later: capture order
//
// Called from the PayPal JS SDK `onApprove` callback (or after a
// redirect approval). Captures the Orders v2 order, records the
// payment on the PayPal invoice, and marks the invoice PAID.
//
// The capture webhook (`PAYMENT.CAPTURE.COMPLETED`) is idempotent
// with this route because it maps the same `custom_id`.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  capturePayPalOrder,
  getPayPalOrder,
  recordInvoicePayment,
} from '@/lib/paypal/toolkit';
import type { PayPalOrderResponse } from '@/types/paypal';

interface InvoiceForCapture {
  id: string;
  status: string;
  amount: number;
  currency: string;
  paypal_invoice_id: string;
}

function firstOrSelf<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function captureFromOrder(order: PayPalOrderResponse) {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];

  return {
    unit,
    capture,
    // PayPal usually echoes custom_id with the order and the capture. Keep both
    // available because the capture response is less complete than the GET.
    customId: unit?.custom_id ?? capture?.custom_id,
    amount: Number(capture?.amount?.value ?? unit?.amount?.value ?? 0),
    currency:
      capture?.amount?.currency_code ??
      unit?.amount?.currency_code ??
      '',
  };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const supabase = createAdminClient();

    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('id, invoice:invoices(id, status, amount, currency, paypal_invoice_id)')
      .eq('token', token)
      .single();

    if (error || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const invoice = firstOrSelf(
      conversation.invoice as InvoiceForCapture | InvoiceForCapture[] | null
    );

    if (!invoice) {
      return NextResponse.json({ error: 'Conversation has no invoice' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({
        success: true,
        already_paid: true,
        invoice_status: 'PAID',
      });
    }

    if (invoice.status !== 'SENT') {
      return NextResponse.json(
        {
          error: `Pay Later cannot be captured for an invoice in status ${invoice.status}`,
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderId =
      typeof body.order_id === 'string'
        ? body.order_id
        : typeof body.orderId === 'string'
          ? body.orderId
          : null;

    if (!orderId) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
    }

    // Validate ownership before charging. PayPal's capture response is less
    // complete than the GET response, so use the GET as the source of truth.
    const orderBefore = await getPayPalOrder(orderId);
    const unitBefore = orderBefore.purchase_units?.[0];
    const customIdBefore =
      unitBefore?.custom_id ?? unitBefore?.payments?.captures?.[0]?.custom_id;

    if (!customIdBefore || customIdBefore !== invoice.id) {
      return NextResponse.json(
        { error: 'PayPal order does not belong to this invoice' },
        { status: 400 }
      );
    }

    let captured: PayPalOrderResponse;

    if (orderBefore.status === 'COMPLETED') {
      // The buyer or the JS SDK already captured this order.
      captured = orderBefore;
    } else {
      if (orderBefore.status !== 'APPROVED') {
        return NextResponse.json(
          {
            error: `PayPal order is ${orderBefore.status}; buyer approval is required`,
          },
          { status: 400 }
        );
      }

      try {
        captured = await capturePayPalOrder(
          orderId,
          `pulsepay-capture-${orderId}`
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);

        // The buyer may have captured through the JS SDK already. Treat the
        // order as captured and reconcile it instead of double-charging.
        if (!/ORDER_ALREADY_CAPTURED|ALREADY_CAPTURED/i.test(message)) {
          return NextResponse.json(
            { error: `Failed to capture PayPal order: ${message}` },
            { status: 502 }
          );
        }

        captured = await getPayPalOrder(orderId);
      }
    }

    const { capture, amount, currency } = captureFromOrder(captured);
    const capturedAmount =
      amount > 0
        ? amount
        : Number(unitBefore?.amount?.value ?? invoice.amount);
    const capturedCurrency =
      currency || unitBefore?.amount?.currency_code || invoice.currency;

    const expectedAmount = Number(invoice.amount);
    if (Math.abs(capturedAmount - expectedAmount) > 0.01) {
      return NextResponse.json(
        {
          error: `Captured amount (${capturedAmount}) does not match invoice amount (${expectedAmount})`,
        },
        { status: 400 }
      );
    }

    if (capturedCurrency !== invoice.currency) {
      return NextResponse.json(
        {
          error: `Captured currency ${capturedCurrency} does not match invoice currency ${invoice.currency}`,
        },
        { status: 400 }
      );
    }

    // Record the payment on the PayPal invoice. The capture already succeeded,
    // so a recording failure must not turn a paid order into an error response.
    let recordWarning: string | null = null;
    try {
      await recordInvoicePayment(invoice.paypal_invoice_id, capturedAmount, {
        method: 'PAYPAL',
        note: `Pay Later capture (order ${orderId})`,
        currency: capturedCurrency,
      });
    } catch (err: unknown) {
      recordWarning = err instanceof Error ? err.message : String(err);
      console.error(
        `Captured order ${orderId} but failed to record payment on ${invoice.paypal_invoice_id}:`,
        recordWarning
      );
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'PAID',
        priority_score: 0,
        priority_reason: 'Paid via PayPal Pay Later',
        synced_at: now,
      })
      .eq('id', invoice.id);

    if (updateError) {
      throw new Error(`Failed to mark invoice paid: ${updateError.message}`);
    }

    await supabase
      .from('conversations')
      .update({ status: 'RESOLVED' })
      .eq('invoice_id', invoice.id);

    await supabase.from('events').insert({
      type: 'PAY_LATER_CAPTURED',
      actor: 'AGENT',
      entity_type: 'invoice',
      entity_id: invoice.id,
      payload: {
        order_id: orderId,
        capture_id: capture?.id ?? null,
        amount: capturedAmount,
        currency: capturedCurrency,
        ...(recordWarning ? { record_warning: recordWarning } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      order_id: orderId,
      capture_id: capture?.id ?? null,
      amount: capturedAmount,
      currency: capturedCurrency,
      invoice_status: 'PAID',
      ...(recordWarning ? { record_warning: recordWarning } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to capture Pay Later payment: ${message}` },
      { status: 500 }
    );
  }
}
