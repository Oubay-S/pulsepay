// ============================================================
// PulsePay — Pay Later Verification (real PayPal Sandbox)
//
// Verifies the Orders v2 backend:
//   • /api/c/[token]/paylater/create creates a real order
//   • the order carries the invoice UUID in `custom_id`
//   • the amount and currency match the invoice
//
// With --manual it also prints the buyer approval link, waits for the
// Sandbox buyer to approve, then calls /paylater/capture and verifies the
// invoice is marked PAID.
//
// Run with:
//   npm run verify:paylater
//   npm run verify:paylater -- --manual --timeout=900
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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function main(): Promise<void> {
  loadEnvLocal();

  const buyerEmail = process.env.PAYPAL_TEST_BUYER_EMAIL;
  if (!buyerEmail) {
    throw new Error('PAYPAL_TEST_BUYER_EMAIL is required for this verification');
  }

  const manual = process.argv.includes('--manual');
  const timeoutMs = Number(argValue('timeout') ?? 900) * 1_000;

  const { NextRequest } = await import('next/server');
  const { POST: createOrder } = await import(
    '../src/app/api/c/[token]/paylater/create/route'
  );
  const { POST: captureOrder } = await import(
    '../src/app/api/c/[token]/paylater/capture/route'
  );
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { createAndSendInvoice } = await import('../src/lib/paypal/invoices');
  const { cancelPayPalInvoice, getPayPalOrder } = await import(
    '../src/lib/paypal/toolkit'
  );

  const supabase = createAdminClient();
  const suffix = Math.random().toString(36).slice(2, 8);
  const token = `paylater-${suffix}`;
  const description = `Pay Later rehearsal ${suffix}`;

  console.log('============================================================');
  console.log(' PulsePay — Pay Later Verification (real PayPal Sandbox)');
  console.log('============================================================');
  console.log(`Buyer: ${buyerEmail}`);
  console.log(`Mode: ${manual ? 'manual buyer approval' : 'create only'}\n`);

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({
      name: 'PulsePay Pay Later Rehearsal',
      paypal_merchant_email: 'paylater@pulsepay.dev',
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
      name: 'Pay Later Buyer',
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

  let paypalInvoiceId: string | undefined;

  try {
    const created = await createAndSendInvoice({
      businessName: business.name,
      clientName: client.name,
      clientEmail: buyerEmail,
      currency: 'USD',
      amount: 50,
      description,
      note: `[PulsePay verification] ${description}`,
      invoiceDate: daysAgo(25),
      dueDate: daysAgo(10),
    });
    paypalInvoiceId = created.id;

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        business_id: business.id,
        client_id: client.id,
        paypal_invoice_id: created.id,
        amount: 50,
        currency: 'USD',
        due_date: daysAgo(10).toISOString(),
        status: 'SENT',
        priority_score: 55,
        priority_reason: 'Pay Later rehearsal',
        description,
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Failed to insert rehearsal invoice: ${invoiceError?.message}`);
    }

    const { error: conversationError } = await supabase
      .from('conversations')
      .insert({ invoice_id: invoice.id, token, status: 'ACTIVE' });

    if (conversationError) {
      throw new Error(
        `Failed to create rehearsal conversation: ${conversationError.message}`
      );
    }

    // ---------- Create order ----------
    const createResponse = await createOrder(
      new NextRequest(`http://localhost/api/c/${token}/paylater/create`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ token }) }
    );

    const createBody = (await createResponse.json()) as {
      id?: string;
      status?: string;
      approve_link?: string | null;
      amount?: number;
      currency?: string;
      error?: string;
    };

    check(
      'Create route returns an Orders v2 order',
      createResponse.status === 200 && Boolean(createBody.id),
      `status=${createResponse.status} order=${createBody.id ?? 'missing'} error=${createBody.error ?? 'none'}`
    );

    check(
      'Order is created in a payable state',
      ['CREATED', 'PAYER_ACTION_REQUIRED', 'APPROVED'].includes(
        createBody.status ?? ''
      ),
      `status=${createBody.status ?? 'missing'}`
    );

    check(
      'Order exposes a Sandbox approval link',
      typeof createBody.approve_link === 'string' &&
        /^https:\/\/(www\.)?sandbox\.paypal\.com\//.test(createBody.approve_link),
      `approve_link=${createBody.approve_link ?? 'missing'}`
    );

    if (!createBody.id) {
      throw new Error('No order ID returned; cannot continue');
    }

    const order = await getPayPalOrder(createBody.id);
    const unit = order.purchase_units?.[0];

    check(
      'Order carries the invoice UUID in custom_id',
      unit?.custom_id === invoice.id,
      `custom_id=${unit?.custom_id ?? 'missing'} invoice=${invoice.id}`
    );

    check(
      'Order amount and currency match the invoice',
      unit?.amount?.value === '50.00' && unit?.amount?.currency_code === 'USD',
      `amount=${unit?.amount?.value ?? 'missing'} ${unit?.amount?.currency_code ?? ''}`
    );

    // ---------- Optional manual capture ----------
    if (manual) {
      console.log('------------------------------------------------------------');
      console.log(' Open this link and pay with the US Sandbox buyer:');
      console.log(`   ${createBody.approve_link}`);
      console.log(`   Buyer: ${buyerEmail}`);
      console.log(`   Choose Pay Later, then approve.`);
      console.log('------------------------------------------------------------\n');

      const started = Date.now();
      let status = order.status;

      while (Date.now() - started < timeoutMs) {
        const latest = await getPayPalOrder(createBody.id);
        status = latest.status;

        if (status === 'APPROVED' || status === 'COMPLETED') break;

        await sleep(2_000);
      }

      check(
        'Buyer approved the order',
        status === 'APPROVED' || status === 'COMPLETED',
        `status=${status} after ${((Date.now() - started) / 1000).toFixed(1)}s`
      );

      const captureResponse = await captureOrder(
        new NextRequest(`http://localhost/api/c/${token}/paylater/capture`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ order_id: createBody.id }),
        }),
        { params: Promise.resolve({ token }) }
      );

      const captureBody = (await captureResponse.json()) as {
        success?: boolean;
        invoice_status?: string;
        capture_id?: string | null;
        amount?: number;
        error?: string;
        record_warning?: string;
      };

      check(
        'Capture route captures the order and records the payment',
        captureResponse.status === 200 &&
          captureBody.success === true &&
          captureBody.invoice_status === 'PAID',
        `status=${captureResponse.status} invoice=${captureBody.invoice_status ?? 'n/a'} capture=${captureBody.capture_id ?? 'none'} error=${captureBody.error ?? 'none'}`
      );

      const { data: paidInvoice } = await supabase
        .from('invoices')
        .select('status, priority_score')
        .eq('id', invoice.id)
        .single();

      check(
        'Invoice is PAID after capture',
        paidInvoice?.status === 'PAID' && Number(paidInvoice?.priority_score) === 0,
        `status=${paidInvoice?.status} priority=${paidInvoice?.priority_score}`
      );

      const { data: resolvedConversation } = await supabase
        .from('conversations')
        .select('status')
        .eq('token', token)
        .single();

      check(
        'Conversation is resolved after capture',
        resolvedConversation?.status === 'RESOLVED',
        `status=${resolvedConversation?.status}`
      );

      const { data: captureEvents } = await supabase
        .from('events')
        .select('id')
        .eq('type', 'PAY_LATER_CAPTURED')
        .filter('payload->>order_id', 'eq', createBody.id);

      check(
        'PAY_LATER_CAPTURED event is logged',
        (captureEvents?.length ?? 0) === 1,
        `rows=${captureEvents?.length ?? 0}`
      );
    } else {
      console.log(
        'Create verified. Run with --manual to approve and capture a real Pay Later payment.\n'
      );
    }
  } finally {
    console.log('------------------------------------------------------------');
    console.log(' Cleaning up rehearsal data...');

    if (paypalInvoiceId) {
      try {
        await cancelPayPalInvoice(
          paypalInvoiceId,
          'PulsePay Pay Later verification cleanup'
        );
      } catch {
        // Already paid or already cancelled.
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
  console.error('\nUnexpected Pay Later verification failure:', error);
  process.exit(1);
});
