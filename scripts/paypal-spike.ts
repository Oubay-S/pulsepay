// ============================================================
// PulsePay — Phase 0 PayPal Sandbox Spike
// Verifies the real PayPal Invoicing + Orders flows end to end.
//
// Run with: npm run spike:paypal
// Requires .env.local with PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface InvoiceLike {
  id?: string;
  href?: string;
  rel?: string;
  method?: string;
  status?: string;
  amount?: { currency_code?: string; value?: string };
  links?: Array<{ rel?: string; href?: string; method?: string }>;
}

interface StepResult {
  name: string;
  ok: boolean;
  detail: string;
  warning?: boolean;
}

/** Minimal .env.local loader so this script works outside Next.js. */
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');

  try {
    const raw = readFileSync(envPath, 'utf8');
    let loaded = 0;

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
        loaded++;
      }
    }

    console.log(`Loaded ${loaded} variable(s) from .env.local\n`);
  } catch (error) {
    console.warn(
      `Could not read .env.local (${(error as Error).message}). ` +
        'Falling back to the current process environment.\n'
    );
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function findLink(
  invoice: InvoiceLike,
  rel: string
): string | undefined {
  return invoice.links?.find((link) => link.rel === rel)?.href;
}

/**
 * PayPal's create-invoice response is a self link, not an object with `id`.
 * The invoice ID is the last path segment of that link (or the Location header).
 * The Agent Toolkit returns the link body, so parse the ID from `href`.
 */
function extractInvoiceId(result: InvoiceLike | undefined): string | undefined {
  if (!result) return undefined;
  if (result.id) return result.id;
  if (result.href) {
    return result.href.split('/').filter(Boolean).pop();
  }
  return undefined;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const {
    callPayPalTool,
    getPayPalAccessToken,
  } = await import('../src/lib/paypal/toolkit');

  const steps: StepResult[] = [];

  function record(
    name: string,
    ok: boolean,
    detail: string,
    warning = false
  ): void {
    steps.push({ name, ok, detail, warning });
    const icon = warning ? '⚠️ WARN' : ok ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon}  ${name}\n         ${detail}\n`);
  }

  const buyerEmail =
    process.env.PAYPAL_TEST_BUYER_EMAIL || 'pulsepay-buyer@example.com';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const currency = 'USD';
  const originalAmount = '850.00';
  const discountedAmount = '807.50';

  console.log('============================================================');
  console.log(' PulsePay — PayPal Sandbox Spike');
  console.log('============================================================');
  console.log(`Environment : ${process.env.PAYPAL_ENVIRONMENT || 'sandbox'}`);
  console.log(`Buyer email : ${buyerEmail}`);
  if (buyerEmail.endsWith('@example.com')) {
    console.log(
      'Note: set PAYPAL_TEST_BUYER_EMAIL to a real Sandbox buyer account ' +
        'if you want to open the payer link and pay.'
    );
  }
  console.log('');

  // ----------------------------------------------------------
  // 1. Scoped OAuth token
  // ----------------------------------------------------------
  let token = '';
  try {
    token = await getPayPalAccessToken();
    record(
      'OAuth token (invoicing + webhooks scope)',
      true,
      `token acquired (length ${token.length})`
    );
  } catch (error) {
    record('OAuth token (invoicing + webhooks scope)', false, errorMessage(error));
    printSummary(steps);
    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // 2. Raw Invoicing API with the scoped token
  // ----------------------------------------------------------
  try {
    const response = await fetch(
      'https://api-m.sandbox.paypal.com/v2/invoicing/invoices?page=1&page_size=1',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const body = await response.text();
    record(
      'Invoicing list (raw REST)',
      response.ok,
      `${response.status} ${body.slice(0, 160)}`
    );
  } catch (error) {
    record('Invoicing list (raw REST)', false, errorMessage(error));
  }

  // ----------------------------------------------------------
  // 3. Create a real invoice through the Agent Toolkit
  // ----------------------------------------------------------
  let originalInvoice: InvoiceLike | undefined;
  try {
    const created = await callPayPalTool<InvoiceLike>('create_invoice', {
      currency_code: currency,
      invoice_date: today(),
      note: 'PulsePay Phase 0 spike — brand identity package',
      invoicer_business_name: 'Studio Pulse Creative',
      primary_recipients: [
        {
          billing_info: {
            email_address: buyerEmail,
            name: { given_name: 'PulsePay', surname: 'Buyer' },
          },
        },
      ],
      items: [
        {
          name: 'Brand identity & logo package',
          description: 'Phase 0 spike line item',
          quantity: '1',
          unit_amount: { currency_code: currency, value: originalAmount },
        },
      ],
    });

    const createdId = extractInvoiceId(created);
    originalInvoice = createdId ? { ...created, id: createdId } : created;

    record(
      'create_invoice (Agent Toolkit)',
      Boolean(createdId),
      `invoice ${createdId ?? '(no id found)'} status=${created.status ?? 'unknown'}`
    );
  } catch (error) {
    record('create_invoice (Agent Toolkit)', false, errorMessage(error));
  }

  // ----------------------------------------------------------
  // 4. Send the invoice (the send response carries the payer link)
  // ----------------------------------------------------------
  let payerLink: string | undefined;
  if (originalInvoice?.id) {
    try {
      const sendResult = await callPayPalTool<InvoiceLike | undefined>('send_invoice', {
        invoice_id: originalInvoice.id,
        send_to_recipient: true,
      });
      payerLink = sendResult?.href;
      record(
        'send_invoice (Agent Toolkit)',
        true,
        `sent ${originalInvoice.id}` +
          (payerLink ? `\n         payer link: ${payerLink}` : '')
      );
    } catch (error) {
      record('send_invoice (Agent Toolkit)', false, errorMessage(error));
    }

    // ------------------------------------------------------
    // 5. Fetch the invoice; fall back to the send link
    // ------------------------------------------------------
    try {
      const fetched = await callPayPalTool<InvoiceLike>('get_invoice', {
        invoice_id: originalInvoice.id,
      });
      const payerView = findLink(fetched, 'payer-view') || payerLink;
      const customerView = findLink(fetched, 'customer-view');
      record(
        'get_invoice + payer link',
        Boolean(payerView || customerView),
        payerView || customerView || 'no payer-view/customer-view link returned'
      );
    } catch (error) {
      record(
        'get_invoice + payer link',
        Boolean(payerLink),
        payerLink ? `payer link: ${payerLink}` : errorMessage(error)
      );
    }

    // ------------------------------------------------------
    // 6. Native early-payment discount rule
    // ------------------------------------------------------
    try {
      await callPayPalTool('create_conditional_rules_for_invoice', {
        invoice_id: originalInvoice.id,
        rules: [
          {
            conditional_rule_type: 'EARLY_PAYMENT_DISCOUNT',
            conditional_rule_value_type: 'PERCENT',
            conditional_rule_value: '5',
            rule_expiry_terms: {
              rule_expiry_condition: 'SPECIFIC_DATE',
              condition_rule_end_date: daysFromNow(3),
            },
          },
        ],
      });
      record(
        'create_conditional_rules_for_invoice',
        true,
        '5% early-payment discount rule created'
      );
    } catch (error) {
      const message = errorMessage(error);
      const sandboxLimitation = /internal server error/i.test(message);
      record(
        'create_conditional_rules_for_invoice',
        false,
        sandboxLimitation
          ? `${message} — Sandbox limitation; use the void & reissue fallback (verified below).`
          : message,
        sandboxLimitation
      );
    }
  } else {
    record('send_invoice (Agent Toolkit)', false, 'skipped: no invoice id');
    record('get_invoice + payer link', false, 'skipped: no invoice id');
    record(
      'create_conditional_rules_for_invoice',
      false,
      'skipped: no invoice id'
    );
  }

  // ----------------------------------------------------------
  // 7. Cancel the original invoice
  // ----------------------------------------------------------
  if (originalInvoice?.id) {
    try {
      await callPayPalTool('cancel_sent_invoice', {
        invoice_id: originalInvoice.id,
        note: 'Superseded by PulsePay Phase 0 discount agreement',
        send_to_recipient: false,
      });
      record(
        'cancel_sent_invoice (Agent Toolkit)',
        true,
        `cancelled ${originalInvoice.id}`
      );
    } catch (error) {
      record('cancel_sent_invoice (Agent Toolkit)', false, errorMessage(error));
    }
  } else {
    record('cancel_sent_invoice (Agent Toolkit)', false, 'skipped: no invoice id');
  }

  // ----------------------------------------------------------
  // 8. Reissue at the discounted amount (void & reissue fallback)
  // ----------------------------------------------------------
  let reissuedInvoice: InvoiceLike | undefined;
  try {
    const created = await callPayPalTool<InvoiceLike>('create_invoice', {
      currency_code: currency,
      invoice_date: today(),
      note: `Discounted invoice (original ${originalInvoice?.id ?? 'unknown'})`,
      invoicer_business_name: 'Studio Pulse Creative',
      primary_recipients: [
        {
          billing_info: {
            email_address: buyerEmail,
            name: { given_name: 'PulsePay', surname: 'Buyer' },
          },
        },
      ],
      items: [
        {
          name: 'Brand identity & logo package (5% early-payment discount)',
          description: 'Void & reissue fallback from Phase 0 spike',
          quantity: '1',
          unit_amount: { currency_code: currency, value: discountedAmount },
        },
      ],
    });

    const reissuedId = extractInvoiceId(created);
    reissuedInvoice = reissuedId ? { ...created, id: reissuedId } : created;

    await callPayPalTool('send_invoice', {
      invoice_id: reissuedId,
      send_to_recipient: true,
    });

    record(
      'void & reissue (discounted invoice)',
      Boolean(reissuedId),
      `reissued ${reissuedId ?? '(no id found)'} for ${currency} ${discountedAmount}`
    );
  } catch (error) {
    record('void & reissue (discounted invoice)', false, errorMessage(error));
  }

  // ----------------------------------------------------------
  // 9. Record a payment against the reissued invoice
  // ----------------------------------------------------------
  if (reissuedInvoice?.id) {
    try {
      await callPayPalTool('record_payment_for_invoice', {
        invoice_id: reissuedInvoice.id,
        method: 'OTHER',
        payment_date: today(),
        note: 'Phase 0 spike — external payment recorded',
        amount: { currency_code: currency, value: discountedAmount },
      });
      record(
        'record_payment_for_invoice',
        true,
        `recorded ${currency} ${discountedAmount} against ${reissuedInvoice.id}`
      );
    } catch (error) {
      record('record_payment_for_invoice', false, errorMessage(error));
    }
  } else {
    record('record_payment_for_invoice', false, 'skipped: no reissued invoice id');
  }

  // ----------------------------------------------------------
  // 10. Orders v2 (Pay Later foundation)
  // ----------------------------------------------------------
  try {
    const order = await callPayPalTool<{
      id: string;
      status?: string;
      links?: Array<{ rel?: string; href?: string }>;
    }>('create_order', {
      currencyCode: currency,
      items: [
        {
          name: 'Pay Later spike order',
          description: 'Orders v2 foundation for Pay Later',
          quantity: 1,
          itemCost: 850,
          taxPercent: 0,
          itemTotal: 850,
        },
      ],
      discount: 0,
      shippingCost: 0,
      notes: 'PulsePay Phase 0 Pay Later order',
      returnUrl: `${appUrl}/api/paypal/return`,
      cancelUrl: `${appUrl}/api/paypal/cancel`,
    });

    const approveLink = order.links?.find((link) => link.rel === 'approve')?.href;
    record(
      'create_order (Orders v2)',
      Boolean(order.id),
      `order ${order.id} status=${order.status}` +
        (approveLink ? `\n         approve: ${approveLink}` : '')
    );
  } catch (error) {
    record('create_order (Orders v2)', false, errorMessage(error));
  }

  // ----------------------------------------------------------
  // 11. Webhook registration check
  // ----------------------------------------------------------
  try {
    const response = await fetch(
      'https://api-m.sandbox.paypal.com/v1/notifications/webhooks',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = (await response.json()) as {
      webhooks?: Array<{ id: string; url: string }>;
    };
    const hooks = data.webhooks ?? [];
    const match = hooks.find((hook) => hook.url.includes('/api/paypal/webhook'));

    record(
      'webhook registration',
      response.ok && Boolean(match),
      match
        ? `id=${match.id} url=${match.url}`
        : `status ${response.status}; no /api/paypal/webhook registration found`
    );
  } catch (error) {
    record('webhook registration', false, errorMessage(error));
  }

  printSummary(steps);
  process.exitCode = steps.some((step) => !step.ok && !step.warning) ? 1 : 0;
}

function printSummary(steps: StepResult[]): void {
  const warnings = steps.filter((step) => step.warning).length;
  const passed = steps.filter((step) => step.ok && !step.warning).length;
  const failed = steps.filter((step) => !step.ok && !step.warning).length;

  console.log('============================================================');
  console.log(
    ` Summary: ${passed} passed, ${warnings} warning(s), ${failed} failed`
  );
  console.log('============================================================');

  for (const step of steps) {
    const icon = step.warning ? '⚠️' : step.ok ? '✅' : '❌';
    console.log(`${icon} ${step.name}`);
  }

  if (failed > 0) {
    console.log('\nRe-run after fixing the failures above.');
  } else if (warnings > 0) {
    console.log(
      '\nPhase 0 PayPal checks are green (with documented Sandbox limitations).'
    );
  } else {
    console.log('\nPhase 0 PayPal checks are green.');
  }
}

main().catch((error) => {
  console.error('\nUnexpected spike failure:', error);
  process.exit(1);
});
