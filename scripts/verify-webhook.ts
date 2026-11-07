// ============================================================
// PulsePay — Webhook Handler Verification
// Exercises the real route with signature verification bypassed
// only for this local test, then verifies rejection when disabled.
//
// Run with: npx tsx scripts/verify-webhook.ts
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

function loadEnvLocal(): void {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const checks: Check[] = [];

function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}\n         ${detail}\n`);
}

function makeEvent(id: string, type: string, resource: Record<string, unknown>) {
  return {
    id,
    event_version: '1.0',
    create_time: new Date().toISOString(),
    resource_type: type.startsWith('PAYMENT') ? 'capture' : 'invoice',
    event_type: type,
    summary: 'PulsePay webhook verification',
    resource,
    links: [],
  };
}

async function main(): Promise<void> {
  loadEnvLocal();

  // Local-only bypass so we can exercise the handler without PayPal headers.
  process.env.PAYPAL_WEBHOOK_SKIP_VERIFY = 'true';

  const { NextRequest } = await import('next/server');
  const { POST } = await import('../src/app/api/paypal/webhook/route');
  const { createAdminClient } = await import('../src/lib/supabase/admin');

  const supabase = createAdminClient();
  const suffix = Math.random().toString(36).slice(2, 8);
  const paidEventId = `WH-PAID-${suffix}`;
  const captureEventId = `WH-CAPTURE-${suffix}`;

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({
      name: 'PulsePay Webhook Verification',
      paypal_merchant_email: 'webhook@pulsepay.dev',
      currency: 'USD',
      tone: 'friendly',
    })
    .select()
    .single();

  if (businessError || !business) {
    throw new Error(`Failed to create business: ${businessError?.message}`);
  }

  const { data: client } = await supabase
    .from('clients')
    .insert({
      business_id: business.id,
      name: 'Webhook Buyer',
      email: 'webhook-buyer@example.com',
      on_time_rate: 80,
    })
    .select()
    .single();

  const { data: invoice } = await supabase
    .from('invoices')
    .insert({
      business_id: business.id,
      client_id: client!.id,
      paypal_invoice_id: `INV2-WEBHOOK-${suffix}`,
      amount: 500,
      currency: 'USD',
      due_date: new Date().toISOString(),
      status: 'SENT',
      priority_score: 60,
      priority_reason: 'Webhook verification',
      description: 'Webhook verification invoice',
    })
    .select()
    .single();

  const { data: conversation } = await supabase
    .from('conversations')
    .insert({
      invoice_id: invoice!.id,
      token: `webhook-${suffix}`,
      status: 'ACTIVE',
    })
    .select()
    .single();

  try {
    const paidEvent = makeEvent(paidEventId, 'INVOICING.INVOICE.PAID', {
      id: invoice!.paypal_invoice_id,
    });

    const firstResponse = await POST(
      new NextRequest('http://localhost/api/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(paidEvent),
      })
    );

    const firstBody = await firstResponse.json();

    check(
      'Signed-off paid event is accepted',
      firstResponse.status === 200 && firstBody.received === true,
      `status=${firstResponse.status} body=${JSON.stringify(firstBody)}`
    );

    const { data: paidInvoice } = await supabase
      .from('invoices')
      .select('status, priority_score')
      .eq('id', invoice!.id)
      .single();

    check(
      'Invoice marked PAID',
      paidInvoice?.status === 'PAID' && Number(paidInvoice?.priority_score) === 0,
      `status=${paidInvoice?.status} priority=${paidInvoice?.priority_score}`
    );

    const { data: resolvedConversation } = await supabase
      .from('conversations')
      .select('status')
      .eq('id', conversation!.id)
      .single();

    check(
      'Conversation resolved',
      resolvedConversation?.status === 'RESOLVED',
      `status=${resolvedConversation?.status}`
    );

    const replayResponse = await POST(
      new NextRequest('http://localhost/api/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(paidEvent),
      })
    );
    const replayBody = await replayResponse.json();

    check(
      'Replayed event is ignored as duplicate',
      replayResponse.status === 200 && replayBody.duplicate === true,
      `status=${replayResponse.status} body=${JSON.stringify(replayBody)}`
    );

    const { data: paymentEvents } = await supabase
      .from('events')
      .select('id')
      .eq('type', 'PAYMENT_RECEIVED')
      .filter('payload->>event_id', 'eq', paidEventId);

    check(
      'Replay did not duplicate the payment event',
      (paymentEvents?.length ?? 0) === 1,
      `PAYMENT_RECEIVED rows=${paymentEvents?.length ?? 0}`
    );

    // ---------- Capture mapping ----------
    const { data: captureInvoice } = await supabase
      .from('invoices')
      .insert({
        business_id: business.id,
        client_id: client!.id,
        paypal_invoice_id: `INV2-CAPTURE-${suffix}`,
        amount: 300,
        currency: 'USD',
        due_date: new Date().toISOString(),
        status: 'SENT',
        priority_score: 40,
        priority_reason: 'Capture verification',
        description: 'Capture verification invoice',
      })
      .select()
      .single();

    const captureEvent = makeEvent(captureEventId, 'PAYMENT.CAPTURE.COMPLETED', {
      id: `CAPTURE-${suffix}`,
      custom_id: captureInvoice!.id,
      supplementary_data: {
        related_ids: { order_id: `ORDER-${suffix}` },
      },
    });

    const captureResponse = await POST(
      new NextRequest('http://localhost/api/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(captureEvent),
      })
    );

    const { data: capturedInvoice } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', captureInvoice!.id)
      .single();

    check(
      'Capture resolves invoice via custom_id',
      captureResponse.status === 200 && capturedInvoice?.status === 'PAID',
      `status=${captureResponse.status} invoice=${capturedInvoice?.status}`
    );

    // ---------- Unsigned request is rejected ----------
    process.env.PAYPAL_WEBHOOK_SKIP_VERIFY = 'false';

    const unsignedResponse = await POST(
      new NextRequest('http://localhost/api/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          makeEvent(`WH-UNSIGNED-${suffix}`, 'INVOICING.INVOICE.PAID', {
            id: invoice!.paypal_invoice_id,
          })
        ),
      })
    );

    check(
      'Unsigned request is rejected',
      unsignedResponse.status === 400,
      `status=${unsignedResponse.status}`
    );
  } finally {
    await supabase
      .from('processed_events')
      .delete()
      .in('paypal_event_id', [
        paidEventId,
        captureEventId,
        `WH-UNSIGNED-${suffix}`,
      ]);
    await supabase.from('businesses').delete().eq('id', business.id);
  }

  const passed = checks.filter((item) => item.ok).length;
  const failed = checks.length - passed;

  console.log('============================================================');
  console.log(` Summary: ${passed} passed, ${failed} failed`);
  console.log('============================================================');

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('\nUnexpected webhook verification failure:', error);
  process.exit(1);
});
