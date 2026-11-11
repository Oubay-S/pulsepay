// ============================================================
// PulsePay — Block C Rehearsal (real PayPal Sandbox)
//
// Exercises the demo loop through the real API routes:
//   client accepts a discount
//     → executor supersedes the original invoice in PayPal
//     → client receives a payable link
//     → payment arrives through the real PayPal webhook
//     → DB flips to PAID and the conversation resolves
//   client accepts a 3-installment plan
//     → installment 1 is sent
//     → the demo clock advances and installment 2 is sent
//
// Modes:
//   npm run verify:block-c
//     records the payment through PayPal's API (real webhook delivery).
//
//   npm run verify:block-c -- --manual [--timeout=600]
//     prints the payer link and waits for a human Sandbox checkout.
//
// Every row and PayPal invoice is cleaned up at the end.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { createAdminClient } from '../src/lib/supabase/admin';

type Supabase = ReturnType<typeof createAdminClient>;

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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function waitForInvoiceStatus(
  supabase: Supabase,
  paypalInvoiceId: string,
  expected: string,
  timeoutMs: number
): Promise<{ status: string | null; waitedMs: number }> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { data } = await supabase
      .from('invoices')
      .select('status')
      .eq('paypal_invoice_id', paypalInvoiceId)
      .maybeSingle();

    if (data?.status === expected) {
      return { status: data.status, waitedMs: Date.now() - started };
    }

    await sleep(2_000);
  }

  const { data } = await supabase
    .from('invoices')
    .select('status')
    .eq('paypal_invoice_id', paypalInvoiceId)
    .maybeSingle();

  return { status: data?.status ?? null, waitedMs: Date.now() - started };
}

async function main(): Promise<void> {
  loadEnvLocal();

  const buyerEmail = process.env.PAYPAL_TEST_BUYER_EMAIL;
  if (!buyerEmail) {
    throw new Error('PAYPAL_TEST_BUYER_EMAIL is required for this rehearsal');
  }

  const manual = process.argv.includes('--manual');
  const manualTimeoutMs = Number(argValue('timeout') ?? 600) * 1_000;

  const { NextRequest } = await import('next/server');
  const { POST: acceptAgreement } = await import(
    '../src/app/api/c/[token]/accept/route'
  );
  const { POST: advanceClock } = await import(
    '../src/app/api/demo/clock/route'
  );
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { createAndSendInvoice } = await import('../src/lib/paypal/invoices');
  const { cancelPayPalInvoice, recordInvoicePayment } = await import(
    '../src/lib/paypal/toolkit'
  );

  const supabase = createAdminClient();
  const suffix = Math.random().toString(36).slice(2, 8);
  const createdPayPalIds: string[] = [];

  const originalDescription = `Block C rehearsal original ${suffix}`;
  const planDescription = `Block C rehearsal plan ${suffix}`;

  console.log('============================================================');
  console.log(' PulsePay — Block C Rehearsal (real PayPal Sandbox)');
  console.log('============================================================');
  console.log(`Buyer: ${buyerEmail}`);
  console.log(`Mode: ${manual ? 'manual checkout' : 'automated payment via PayPal API'}\n`);

  // ---------- Setup ----------
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({
      name: 'PulsePay Block C Rehearsal',
      paypal_merchant_email: 'block-c@pulsepay.dev',
      currency: 'USD',
      tone: 'friendly',
    })
    .select()
    .single();

  if (businessError || !business) {
    throw new Error(`Failed to create rehearsal business: ${businessError?.message}`);
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      business_id: business.id,
      name: 'Block C Buyer',
      email: buyerEmail,
      on_time_rate: 80,
      total_invoices: 1,
      total_paid: 0,
    })
    .select()
    .single();

  if (clientError || !client) {
    throw new Error(`Failed to create rehearsal client: ${clientError?.message}`);
  }

  async function createTrackedInvoice(
    amount: number,
    description: string,
    token: string
  ) {
    const created = await createAndSendInvoice({
      businessName: business.name,
      clientName: client.name,
      clientEmail: buyerEmail!,
      currency: 'USD',
      amount,
      description,
      note: `[PulsePay verification] ${description}`,
      invoiceDate: daysAgo(25),
      dueDate: daysAgo(10),
    });

    createdPayPalIds.push(created.id);

    const { data: row, error } = await supabase
      .from('invoices')
      .insert({
        business_id: business.id,
        client_id: client.id,
        paypal_invoice_id: created.id,
        amount,
        currency: 'USD',
        due_date: daysAgo(10).toISOString(),
        status: 'SENT',
        priority_score: 55,
        priority_reason: 'Block C rehearsal',
        description,
      })
      .select()
      .single();

    if (error || !row) {
      throw new Error(`Failed to insert rehearsal invoice: ${error?.message}`);
    }

    const { error: conversationError } = await supabase
      .from('conversations')
      .insert({ invoice_id: row.id, token, status: 'ACTIVE' });

    if (conversationError) {
      throw new Error(
        `Failed to create rehearsal conversation: ${conversationError.message}`
      );
    }

    return row;
  }

  try {
    // ========================================================
    // 1. Discount: accept route → void & reissue → payer link
    // ========================================================
    const discountInvoice = await createTrackedInvoice(
      100,
      originalDescription,
      `block-c-discount-${suffix}`
    );

    const { data: discountArrangement, error: discountArrangementError } =
      await supabase
        .from('arrangements')
        .insert({
          invoice_id: discountInvoice.id,
          type: 'DISCOUNT',
          terms: { type: 'discount', discount_pct: 5, deadline_hours: 48 },
          status: 'PROPOSED',
        })
        .select()
        .single();

    if (discountArrangementError || !discountArrangement) {
      throw new Error(
        `Failed to create discount arrangement: ${discountArrangementError?.message}`
      );
    }

    const acceptResponse = await acceptAgreement(
      new NextRequest(`http://localhost/api/c/block-c-discount-${suffix}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ arrangement_id: discountArrangement.id }),
      }),
      { params: Promise.resolve({ token: `block-c-discount-${suffix}` }) }
    );

    const acceptBody = (await acceptResponse.json()) as {
      success?: boolean;
      error?: string;
      payer_link?: string;
      payable?: {
        paypal_invoice_id: string;
        payer_link: string;
        amount: number;
        kind: string;
      };
      execution?: { action?: string; details?: Record<string, unknown> };
    };

    check(
      'Client accept route executes the discount',
      acceptResponse.status === 200 && acceptBody.success === true,
      `status=${acceptResponse.status} action=${acceptBody.execution?.action ?? 'n/a'} error=${acceptBody.error ?? 'none'}`
    );

    check(
      'Accept response returns a payable PayPal link',
      Boolean(acceptBody.payable?.payer_link) &&
        acceptBody.payable?.kind === 'invoice' &&
        Number(acceptBody.payable?.amount) === 95,
      `payable=${JSON.stringify(acceptBody.payable ?? null)}`
    );

    // Regression: accepting a discount moves the conversation to the child
    // invoice while the arrangement stays on the parent. The client portal must
    // still show the accepted offer instead of "No options yet".
    const { getClientPortalPayload } = await import('../src/lib/client-portal/server');
    const portalAfterAccept = await getClientPortalPayload(`block-c-discount-${suffix}`);
    const acceptedOffer = portalAfterAccept.offers.find(
      (offer) => offer.id === discountArrangement.id
    );

    check(
      'Accepted discount stays visible in the client portal after reissue',
      Boolean(acceptedOffer) && acceptedOffer?.status === 'ACCEPTED',
      `offers=${portalAfterAccept.offers.length} status=${acceptedOffer?.status ?? 'missing'}`
    );

    const { data: discountChild } = await supabase
      .from('invoices')
      .select('*')
      .eq('parent_invoice_id', discountInvoice.paypal_invoice_id)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    check(
      'Discounted reissue is stored with a real PayPal ID',
      Boolean(discountChild?.paypal_invoice_id?.startsWith('INV2-')) &&
        Number(discountChild?.amount) === 95,
      discountChild
        ? `id=${discountChild.paypal_invoice_id} amount=${discountChild.amount}`
        : 'no child invoice'
    );

    if (!discountChild?.paypal_invoice_id) {
      throw new Error('No discounted child invoice found; cannot continue');
    }

    createdPayPalIds.push(discountChild.paypal_invoice_id);

    const payerLink =
      acceptBody.payable?.payer_link ??
      `https://www.sandbox.paypal.com/invoice/p/#${discountChild.paypal_invoice_id}`;

    console.log('------------------------------------------------------------');
    console.log(' PayPal payer link for the manual checkout:');
    console.log(`   ${payerLink}`);
    console.log(`   Buyer: ${buyerEmail}`);
    console.log('------------------------------------------------------------\n');

    // ---------- Payment ----------
    if (manual) {
      console.log(
        `Waiting up to ${manualTimeoutMs / 1000}s for the Sandbox buyer to pay...\n`
      );
    } else {
      await recordInvoicePayment(discountChild.paypal_invoice_id, 95, {
        note: '[PulsePay verification] Block C automated payment',
      });
      console.log('Recorded a real PayPal payment; waiting for the webhook...\n');
    }

    const paidResult = await waitForInvoiceStatus(
      supabase,
      discountChild.paypal_invoice_id,
      'PAID',
      manual ? manualTimeoutMs : 120_000
    );

    check(
      'Webhook flips the reissued invoice to PAID',
      paidResult.status === 'PAID',
      `status=${paidResult.status} after ${(paidResult.waitedMs / 1000).toFixed(1)}s`
    );

    // The webhook flips the invoice before it resolves the conversation, so
    // poll briefly instead of racing it.
    let resolvedConversation: { status: string } | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { data } = await supabase
        .from('conversations')
        .select('status')
        .eq('token', `block-c-discount-${suffix}`)
        .single();

      resolvedConversation = data;
      if (data?.status === 'RESOLVED') break;
      await sleep(500);
    }

    check(
      'Paid invoice resolves the client conversation',
      resolvedConversation?.status === 'RESOLVED',
      `status=${resolvedConversation?.status}`
    );

    // The webhook flips the invoice before it writes the event row, so poll
    // briefly instead of racing it.
    let paymentEvents: { id: string }[] | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { data } = await supabase
        .from('events')
        .select('id')
        .eq('type', 'PAYMENT_RECEIVED')
        .filter('payload->>paypal_invoice_id', 'eq', discountChild.paypal_invoice_id);

      paymentEvents = data;
      if ((paymentEvents?.length ?? 0) > 0) break;
      await sleep(500);
    }

    check(
      'A real PayPal webhook event was recorded',
      (paymentEvents?.length ?? 0) >= 1,
      `PAYMENT_RECEIVED rows=${paymentEvents?.length ?? 0}`
    );

    // ========================================================
    // 2. Plan: accept route → installment 1 → clock → #2
    // ========================================================
    const planInvoice = await createTrackedInvoice(
      1200,
      planDescription,
      `block-c-plan-${suffix}`
    );

    const planInstallments = [
      {
        number: 1,
        amount: 400,
        due_date: new Date().toISOString(),
      },
      {
        number: 2,
        amount: 400,
        // Due yesterday so a single demo-clock day sends it, without touching
        // the seeded Tariq schedule (which is due 16 days out).
        due_date: daysAgo(1).toISOString(),
      },
      {
        number: 3,
        amount: 400,
        due_date: daysFromNow(60).toISOString(),
      },
    ];

    const { data: planArrangement, error: planArrangementError } = await supabase
      .from('arrangements')
      .insert({
        invoice_id: planInvoice.id,
        type: 'PLAN',
        terms: { type: 'plan', installments: planInstallments },
        status: 'PROPOSED',
      })
      .select()
      .single();

    if (planArrangementError || !planArrangement) {
      throw new Error(
        `Failed to create plan arrangement: ${planArrangementError?.message}`
      );
    }

    const planAcceptResponse = await acceptAgreement(
      new NextRequest(`http://localhost/api/c/block-c-plan-${suffix}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ arrangement_id: planArrangement.id }),
      }),
      { params: Promise.resolve({ token: `block-c-plan-${suffix}` }) }
    );

    const planAcceptBody = (await planAcceptResponse.json()) as {
      success?: boolean;
      error?: string;
      payable?: {
        paypal_invoice_id: string;
        payer_link: string;
        kind: string;
        installment_number?: number;
      };
      execution?: { action?: string };
    };

    check(
      'Client accept route executes the plan',
      planAcceptResponse.status === 200 && planAcceptBody.success === true,
      `status=${planAcceptResponse.status} action=${planAcceptBody.execution?.action ?? 'n/a'} error=${planAcceptBody.error ?? 'none'}`
    );

    check(
      'Plan exposes installment 1 as the payable target',
      planAcceptBody.payable?.kind === 'installment' &&
        planAcceptBody.payable?.installment_number === 1 &&
        Boolean(planAcceptBody.payable?.payer_link),
      `payable=${JSON.stringify(planAcceptBody.payable ?? null)}`
    );

    const { data: installmentRows } = await supabase
      .from('installments')
      .select('*')
      .eq('arrangement_id', planArrangement.id)
      .order('number', { ascending: true });

    const firstInstallment = installmentRows?.find((row) => row.number === 1);
    const secondInstallment = installmentRows?.find((row) => row.number === 2);

    if (firstInstallment?.paypal_invoice_id) {
      createdPayPalIds.push(firstInstallment.paypal_invoice_id);
    }
    if (secondInstallment?.paypal_invoice_id) {
      createdPayPalIds.push(secondInstallment.paypal_invoice_id);
    }

    check(
      'Installment 1 is SENT with a real PayPal ID',
      firstInstallment?.status === 'SENT' &&
        Boolean(firstInstallment?.paypal_invoice_id?.startsWith('INV2-')),
      firstInstallment
        ? `status=${firstInstallment.status} id=${firstInstallment.paypal_invoice_id}`
        : 'installment 1 missing'
    );

    check(
      'Installment 2 starts SCHEDULED',
      secondInstallment?.status === 'SCHEDULED' &&
        secondInstallment?.paypal_invoice_id === null,
      `status=${secondInstallment?.status} paypal=${secondInstallment?.paypal_invoice_id ?? 'null'}`
    );

    const clockResponse = await advanceClock(
      new NextRequest('http://localhost/api/demo/clock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ days: 1 }),
      })
    );

    const clockBody = (await clockResponse.json()) as {
      success?: boolean;
      scheduler_results?: { sent?: number; errors?: string[] };
      error?: string;
    };

    check(
      'Advancing the demo clock runs the scheduler',
      clockResponse.status === 200 &&
        clockBody.success === true &&
        (clockBody.scheduler_results?.sent ?? 0) >= 1,
      `status=${clockResponse.status} sent=${clockBody.scheduler_results?.sent ?? 0} errors=${JSON.stringify(clockBody.scheduler_results?.errors ?? [])}`
    );

    const { data: secondAfterClock } = await supabase
      .from('installments')
      .select('*')
      .eq('arrangement_id', planArrangement.id)
      .eq('number', 2)
      .single();

    if (
      secondAfterClock?.paypal_invoice_id &&
      !createdPayPalIds.includes(secondAfterClock.paypal_invoice_id)
    ) {
      createdPayPalIds.push(secondAfterClock.paypal_invoice_id);
    }

    check(
      'Clock sends installment 2 with a real PayPal ID',
      secondAfterClock?.status === 'SENT' &&
        Boolean(secondAfterClock?.paypal_invoice_id?.startsWith('INV2-')),
      secondAfterClock
        ? `status=${secondAfterClock.status} id=${secondAfterClock.paypal_invoice_id}`
        : 'installment 2 missing'
    );
  } finally {
    // ---------- Cleanup ----------
    console.log('------------------------------------------------------------');
    console.log(' Cleaning up rehearsal data...');

    try {
      await advanceClock(
        new NextRequest('http://localhost/api/demo/clock', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ days: 0 }),
        })
      );
    } catch {
      // Clock reset is best-effort.
    }

    for (const paypalId of createdPayPalIds) {
      try {
        await cancelPayPalInvoice(paypalId, 'PulsePay Block C rehearsal cleanup');
      } catch {
        // Paid or already cancelled.
      }
    }

    await supabase.from('businesses').delete().eq('id', business.id);
    console.log(' Cleanup complete.\n');
  }

  const passed = checks.filter((item) => item.ok).length;
  const failed = checks.length - passed;

  console.log('============================================================');
  console.log(` Summary: ${passed} passed, ${failed} failed`);
  console.log('============================================================');
  for (const item of checks) {
    console.log(`${item.ok ? '✅' : '❌'} ${item.name}`);
  }

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('\nUnexpected Block C failure:', error);
  process.exit(1);
});
