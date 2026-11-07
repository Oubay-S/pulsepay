// ============================================================
// PulsePay — Phase 1 Verification
// Exercises the real executor + scheduler against PayPal Sandbox.
//
// Run with: npx tsx scripts/verify-phase1.ts
// Creates a temporary business, real Sandbox invoices, then cleans up.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  const raw = readFileSync(envPath, 'utf8');

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

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
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

async function main(): Promise<void> {
  loadEnvLocal();

  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { createAndSendInvoice } = await import('../src/lib/paypal/invoices');
  const { executeAgreement } = await import('../src/lib/paypal/executor');
  const { processDueInstallments } = await import('../src/lib/scheduler');
  const { cancelPayPalInvoice, getPayPalInvoice } = await import(
    '../src/lib/paypal/toolkit'
  );

  const buyerEmail = process.env.PAYPAL_TEST_BUYER_EMAIL;
  if (!buyerEmail) {
    throw new Error('PAYPAL_TEST_BUYER_EMAIL is required for this verification');
  }

  const supabase = createAdminClient();
  const createdPayPalIds: string[] = [];

  console.log('============================================================');
  console.log(' PulsePay — Phase 1 Verification (real PayPal Sandbox)');
  console.log('============================================================');
  console.log(`Buyer: ${buyerEmail}\n`);

  // ---------- Setup ----------
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({
      name: 'PulsePay Phase 1 Verification',
      paypal_merchant_email: 'verify@pulsepay.dev',
      currency: 'USD',
      tone: 'friendly',
    })
    .select()
    .single();

  if (businessError || !business) {
    throw new Error(`Failed to create verification business: ${businessError?.message}`);
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      business_id: business.id,
      name: 'Phase One Buyer',
      email: buyerEmail,
      on_time_rate: 80,
      total_invoices: 1,
      total_paid: 0,
    })
    .select()
    .single();

  if (clientError || !client) {
    throw new Error(`Failed to create verification client: ${clientError?.message}`);
  }

  const { count: scheduledBefore } = await supabase
    .from('installments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'SCHEDULED');
  console.log(`Pre-existing SCHEDULED installments in DB: ${scheduledBefore ?? 0}\n`);

  async function createTrackedInvoice(
    amount: number,
    description: string,
    dueDaysAgo: number,
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
      invoiceDate: daysAgo(dueDaysAgo + 23),
      dueDate: daysAgo(dueDaysAgo),
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
        due_date: daysAgo(dueDaysAgo).toISOString(),
        status: 'SENT',
        priority_score: 50,
        priority_reason: 'Verification invoice',
        description,
      })
      .select()
      .single();

    if (error || !row) {
      throw new Error(`Failed to insert invoice row: ${error?.message}`);
    }

    const { error: conversationError } = await supabase
      .from('conversations')
      .insert({ invoice_id: row.id, token, status: 'ACTIVE' });

    if (conversationError) {
      throw new Error(`Failed to create conversation: ${conversationError.message}`);
    }

    return row;
  }

  try {
    // ========================================================
    // 1. Discount — void & reissue
    // ========================================================
    const discountInvoice = await createTrackedInvoice(
      100,
      'Phase 1 discount verification',
      7,
      'verify-discount'
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

    const discountResult = await executeAgreement(
      { type: 'discount', discount_pct: 5, deadline_hours: 48 },
      discountInvoice,
      discountArrangement.id
    );

    check(
      'Discount execution',
      discountResult.success,
      discountResult.success
        ? `action=${discountResult.action} ids=${discountResult.paypal_ids.join(', ')}`
        : discountResult.error
    );

    const { data: originalAfterDiscount } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', discountInvoice.id)
      .single();

    check(
      'Original invoice marked SUPERSEDED',
      originalAfterDiscount?.status === 'SUPERSEDED',
      `status=${originalAfterDiscount?.status}`
    );

    const { data: childInvoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('parent_invoice_id', discountInvoice.paypal_invoice_id);

    const child = childInvoices?.[0];
    check(
      'Discounted invoice stored with real PayPal ID',
      Boolean(child?.paypal_invoice_id?.startsWith('INV2-')) &&
        Number(child?.amount) === 95,
      child
        ? `id=${child.paypal_invoice_id} amount=${child.amount}`
        : 'no child invoice row'
    );

    if (child) {
      createdPayPalIds.push(child.paypal_invoice_id);
      const childPaypal = await getPayPalInvoice(child.paypal_invoice_id);
      check(
        'Discounted invoice is SENT in PayPal',
        childPaypal.status === 'SENT' && childPaypal.amount?.value === '95.00',
        `status=${childPaypal.status} amount=${childPaypal.amount?.value}`
      );
    }

    const originalPaypal = await getPayPalInvoice(discountInvoice.paypal_invoice_id);
    check(
      'Original invoice is CANCELLED in PayPal',
      originalPaypal.status === 'CANCELLED',
      `status=${originalPaypal.status}`
    );

    const { data: movedConversation } = await supabase
      .from('conversations')
      .select('invoice_id')
      .eq('token', 'verify-discount')
      .single();

    check(
      'Client conversation moved to the live invoice',
      movedConversation?.invoice_id === child?.id,
      `conversation.invoice_id=${movedConversation?.invoice_id} child=${child?.id}`
    );

    const discountRetry = await executeAgreement(
      { type: 'discount', discount_pct: 5, deadline_hours: 48 },
      discountInvoice,
      discountArrangement.id
    );

    const { count: childCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('parent_invoice_id', discountInvoice.paypal_invoice_id);

    check(
      'Discount retry is idempotent',
      discountRetry.success &&
        discountRetry.details?.reused === true &&
        childCount === 1,
      `reused=${discountRetry.success ? discountRetry.details?.reused : 'n/a'} childRows=${childCount}`
    );

    // ========================================================
    // 2. Plan — installment 1 sent, rest scheduled
    // ========================================================
    const planInvoice = await createTrackedInvoice(
      1200,
      'Phase 1 plan verification',
      15,
      'verify-plan'
    );

    const planInstallments = [
      { number: 1, amount: 400, due_date: new Date().toISOString() },
      {
        number: 2,
        amount: 400,
        due_date: daysFromNow(30).toISOString(),
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

    const planResult = await executeAgreement(
      { type: 'plan', installments: planInstallments },
      planInvoice,
      planArrangement.id
    );

    check(
      'Plan execution',
      planResult.success,
      planResult.success
        ? `action=${planResult.action} ids=${planResult.paypal_ids.join(', ')}`
        : planResult.error
    );

    const { data: planOriginal } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', planInvoice.id)
      .single();

    check(
      'Original invoice marked SUPERSEDED (plan)',
      planOriginal?.status === 'SUPERSEDED',
      `status=${planOriginal?.status}`
    );

    const { data: planRows } = await supabase
      .from('installments')
      .select('*')
      .eq('arrangement_id', planArrangement.id)
      .order('number', { ascending: true });

    const firstInstallment = planRows?.[0];
    const laterInstallments = planRows?.slice(1) ?? [];

    check(
      'Installment 1 sent with a real PayPal ID',
      firstInstallment?.status === 'SENT' &&
        Boolean(firstInstallment?.paypal_invoice_id?.startsWith('INV2-')),
      firstInstallment
        ? `status=${firstInstallment.status} id=${firstInstallment.paypal_invoice_id}`
        : 'no installment 1'
    );

    check(
      'Installments 2-3 scheduled',
      laterInstallments.length === 2 &&
        laterInstallments.every(
          (row) => row.status === 'SCHEDULED' && row.paypal_invoice_id === null
        ),
      laterInstallments
        .map((row) => `#${row.number}:${row.status}`)
        .join(', ')
    );

    if (firstInstallment?.paypal_invoice_id) {
      createdPayPalIds.push(firstInstallment.paypal_invoice_id);
      const installmentPaypal = await getPayPalInvoice(
        firstInstallment.paypal_invoice_id
      );
      check(
        'Installment 1 is SENT in PayPal',
        installmentPaypal.status === 'SENT' &&
          installmentPaypal.amount?.value === '400.00',
        `status=${installmentPaypal.status} amount=${installmentPaypal.amount?.value}`
      );
    }

    const planRetry = await executeAgreement(
      { type: 'plan', installments: planInstallments },
      planInvoice,
      planArrangement.id
    );

    const { count: planRowCount } = await supabase
      .from('installments')
      .select('id', { count: 'exact', head: true })
      .eq('arrangement_id', planArrangement.id);

    check(
      'Plan retry is idempotent',
      planRetry.success &&
        planRetry.details?.reused === true &&
        planRowCount === 3,
      `reused=${planRetry.success ? planRetry.details?.reused : 'n/a'} installmentRows=${planRowCount}`
    );

    // ========================================================
    // 3. Scheduler — sends installment 2 when it becomes due
    // ========================================================
    // The accept route marks the arrangement ACCEPTED after execution.
    await supabase
      .from('arrangements')
      .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
      .eq('id', planArrangement.id);

    const { error: dueDateError } = await supabase
      .from('installments')
      .update({ due_date: daysAgo(400).toISOString() })
      .eq('arrangement_id', planArrangement.id)
      .eq('number', 2);

    if (dueDateError) {
      throw new Error(`Failed to move installment 2 into the past: ${dueDateError.message}`);
    }

    // Push installment 3 far into the future so only #2 is due.
    await supabase
      .from('installments')
      .update({ due_date: daysFromNow(3650).toISOString() })
      .eq('arrangement_id', planArrangement.id)
      .eq('number', 3);

    const schedulerSummary = await processDueInstallments();

    const { data: secondInstallment } = await supabase
      .from('installments')
      .select('*')
      .eq('arrangement_id', planArrangement.id)
      .eq('number', 2)
      .single();

    check(
      'Scheduler dispatches due installment 2',
      secondInstallment?.status === 'SENT' &&
        Boolean(secondInstallment?.paypal_invoice_id?.startsWith('INV2-')),
      secondInstallment
        ? `status=${secondInstallment.status} id=${secondInstallment.paypal_invoice_id} errors=${schedulerSummary.errors.join(' | ') || 'none'}`
        : 'installment 2 missing'
    );

    if (secondInstallment?.paypal_invoice_id) {
      createdPayPalIds.push(secondInstallment.paypal_invoice_id);
      const secondPaypal = await getPayPalInvoice(
        secondInstallment.paypal_invoice_id
      );
      check(
        'Installment 2 is SENT in PayPal',
        secondPaypal.status === 'SENT' &&
          secondPaypal.amount?.value === '400.00',
        `status=${secondPaypal.status} amount=${secondPaypal.amount?.value}`
      );
    }

    const { data: thirdInstallment } = await supabase
      .from('installments')
      .select('status')
      .eq('arrangement_id', planArrangement.id)
      .eq('number', 3)
      .single();

    check(
      'Future installment 3 stays scheduled',
      thirdInstallment?.status === 'SCHEDULED',
      `status=${thirdInstallment?.status}`
    );
  } finally {
    // ---------- Cleanup ----------
    console.log('------------------------------------------------------------');
    console.log(' Cleaning up verification data...');

    for (const paypalId of createdPayPalIds) {
      try {
        await cancelPayPalInvoice(
          paypalId,
          'PulsePay Phase 1 verification cleanup'
        );
      } catch {
        // Already cancelled or not cancellable — nothing to do.
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
  console.error('\nUnexpected verification failure:', error);
  process.exit(1);
});
