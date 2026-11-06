import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/paypal/webhooks';
import type { PayPalWebhookEvent } from '@/types/paypal';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers = req.headers;

    // 1. Verify cryptographic signature from PayPal
    const isValid = await verifyWebhookSignature(headers, rawBody);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    let event: PayPalWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const eventId = event.id;
    const eventType = event.event_type;
    const supabase = createAdminClient();

    // 2. Idempotency Check: Ignore already processed event IDs
    const { data: alreadyProcessed } = await supabase
      .from('processed_events')
      .select('paypal_event_id')
      .eq('paypal_event_id', eventId)
      .single();

    if (alreadyProcessed) {
      return NextResponse.json({ received: true, note: 'Duplicate event ignored' });
    }

    // Record as processed immediately
    await supabase.from('processed_events').insert({
      paypal_event_id: eventId,
      event_type: eventType,
    });

    // 3. Handle Events
    const resource = event.resource || {};
    const invoiceId = (resource.invoice as Record<string, unknown>)?.id as string || (resource.id as string);

    if (eventType === 'INVOICING.INVOICE.PAID' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      if (invoiceId) {
        // Update invoice in database
        await supabase
          .from('invoices')
          .update({
            status: 'PAID',
            priority_score: 0,
            priority_reason: 'Paid via PayPal',
          })
          .eq('paypal_invoice_id', invoiceId);

        // Also check if this matches any installment
        await supabase
          .from('installments')
          .update({
            status: 'PAID',
            paid_at: new Date().toISOString(),
          })
          .eq('paypal_invoice_id', invoiceId);
      }

      // Log event for Realtime broadcast
      await supabase.from('events').insert({
        type: 'PAYMENT_RECEIVED',
        actor: 'PAYPAL',
        entity_type: 'invoice',
        payload: {
          paypal_invoice_id: invoiceId,
          event_type: eventType,
          summary: event.summary,
        },
      });
    } else if (eventType === 'INVOICING.INVOICE.CANCELLED') {
      if (invoiceId) {
        await supabase
          .from('invoices')
          .update({ status: 'CANCELLED' })
          .eq('paypal_invoice_id', invoiceId);
      }
    }

    return NextResponse.json({
      received: true,
      event_type: eventType,
      event_id: eventId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

