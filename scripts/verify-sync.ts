// ============================================================
// PulsePay — Sync Verification (real PayPal Sandbox)
//
// Creates two real invoices:
//   • one ordinary merchant invoice that sync must import
//   • one `[PulsePay demo]` invoice that sync must skip
//
// Then runs the real /api/sync handler against the demo business and
// verifies the reconciliation rules. Cleans up every row and PayPal
// invoice it creates.
//
// Run with: npm run verify:sync
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

async function main(): Promise<void> {
  loadEnvLocal();

  const buyerEmail = process.env.PAYPAL_TEST_BUYER_EMAIL;
  if (!buyerEmail) {
    throw new Error('PAYPAL_TEST_BUYER_EMAIL is required for this verification');
  }

  const { NextRequest } = await import('next/server');
  const { POST } = await import('../src/app/api/sync/route');
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { createAndSendInvoice } = await import('../src/lib/paypal/invoices');
  const { cancelPayPalInvoice } = await import('../src/lib/paypal/toolkit');

  const supabase = createAdminClient();

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id, name')
    .limit(1)
    .maybeSingle();

  if (businessError || !business) {
    throw new Error(
      'No business found. Run `npm run seed` before `npm run verify:sync`.'
    );
  }

  const suffix = Math.random().toString(36).slice(2, 8);
  const realDescription = `Sync verification invoice ${suffix}`;
  const demoDescription = `[PulsePay demo] Skipped sync invoice ${suffix}`;

  console.log('============================================================');
  console.log(' PulsePay — Sync Verification (real PayPal Sandbox)');
  console.log('============================================================');
  console.log(`Business: ${business.name}`);
  console.log(`Buyer: ${buyerEmail}\n`);

  let realPaypalId: string | undefined;
  let demoPaypalId: string | undefined;

  try {
    const real = await createAndSendInvoice({
      businessName: business.name,
      clientName: 'Sync Verification Client',
      clientEmail: buyerEmail,
      currency: 'USD',
      amount: 123.45,
      description: realDescription,
      note: realDescription,
      invoiceDate: daysAgo(12),
      dueDate: daysAgo(10),
    });
    realPaypalId = real.id;

    const demo = await createAndSendInvoice({
      businessName: business.name,
      clientName: 'Sync Demo Client',
      clientEmail: buyerEmail,
      currency: 'USD',
      amount: 99,
      description: demoDescription,
      note: demoDescription,
      invoiceDate: daysAgo(12),
      dueDate: daysAgo(10),
    });
    demoPaypalId = demo.id;

    const response = await POST(
      new NextRequest('http://localhost/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ business_id: business.id }),
      })
    );

    const body = (await response.json()) as {
      synced?: number;
      created?: number;
      updated?: number;
      skipped?: number;
      errors?: string[];
      error?: string;
    };

    check(
      'Sync handler succeeds',
      response.status === 200 && !body.error,
      `status=${response.status} body=${JSON.stringify(body).slice(0, 400)}`
    );

    check(
      'Ordinary PayPal invoice is imported',
      (body.created ?? 0) >= 1,
      `created=${body.created} skipped=${body.skipped} updated=${body.updated}`
    );

    const { data: imported } = await supabase
      .from('invoices')
      .select('*, client:clients(name, email)')
      .eq('paypal_invoice_id', realPaypalId)
      .maybeSingle();

    const importedClient = imported
      ? Array.isArray(imported.client)
        ? imported.client[0]
        : imported.client
      : null;

    check(
      'Imported invoice has the real PayPal ID',
      imported?.paypal_invoice_id === realPaypalId,
      `paypal_id=${imported?.paypal_invoice_id ?? 'missing'}`
    );

    check(
      'Imported invoice uses the PayPal recipient (no placeholder email)',
      importedClient?.email === buyerEmail,
      `email=${importedClient?.email ?? 'missing'}`
    );

    check(
      'Imported invoice keeps the PayPal due date',
      Boolean(imported?.due_date) &&
        new Date(imported.due_date).toISOString().slice(0, 10) ===
          daysAgo(10).toISOString().slice(0, 10),
      `due_date=${imported?.due_date ?? 'missing'}`
    );

    check(
      'Imported invoice uses the PayPal note as description',
      imported?.description === realDescription,
      `description=${imported?.description ?? 'missing'}`
    );

    check(
      'Imported invoice status matches PayPal',
      imported?.status === 'SENT',
      `status=${imported?.status ?? 'missing'}`
    );

    const { data: skippedDemo } = await supabase
      .from('invoices')
      .select('id')
      .eq('paypal_invoice_id', demoPaypalId)
      .maybeSingle();

    check(
      'Untracked [PulsePay demo] invoice is skipped',
      !skippedDemo && (body.skipped ?? 0) >= 1,
      `dbRow=${skippedDemo ? 'present' : 'absent'} skipped=${body.skipped}`
    );

    const { data: placeholderClient } = await supabase
      .from('clients')
      .select('id')
      .eq('email', 'client@example.com')
      .maybeSingle();

    check(
      'No placeholder client@example.com was created',
      !placeholderClient,
      `client=${placeholderClient ? 'present' : 'absent'}`
    );

    check(
      'Sync reports no errors',
      (body.errors?.length ?? 0) === 0,
      `errors=${JSON.stringify(body.errors ?? []).slice(0, 300)}`
    );

    // ---------- Cleanup ----------
    if (imported) {
      await supabase.from('invoices').delete().eq('id', imported.id);
    }
    if (importedClient?.email === buyerEmail) {
      await supabase
        .from('clients')
        .delete()
        .eq('business_id', business.id)
        .eq('email', buyerEmail);
    }
  } finally {
    for (const paypalId of [realPaypalId, demoPaypalId]) {
      if (!paypalId) continue;
      try {
        await cancelPayPalInvoice(paypalId, 'PulsePay sync verification cleanup');
      } catch {
        // Already cancelled.
      }
    }
  }

  const passed = checks.filter((item) => item.ok).length;
  const failed = checks.length - passed;

  console.log('============================================================');
  console.log(` Summary: ${passed} passed, ${failed} failed`);
  console.log('============================================================');

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('\nUnexpected sync verification failure:', error);
  process.exit(1);
});
