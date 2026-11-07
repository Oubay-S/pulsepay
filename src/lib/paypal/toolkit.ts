// ============================================================
// PulsePay — PayPal API & Toolkit Wrapper
// Handles PayPal Invoicing v2, Orders v2, and webhook operations
// ============================================================

import {
  ALL_TOOLS_ENABLED,
  PayPalAgentToolkit,
} from '@paypal/agent-toolkit/openai';
import type { PayPalInvoice } from '@/types/paypal';

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const PAYPAL_IS_SANDBOX = process.env.PAYPAL_ENVIRONMENT !== 'production';

/**
 * Scopes PayPal only grants when they are requested explicitly.
 * The default client_credentials token omits `services/invoicing`, which
 * makes every Invoicing v2 call return 403 NOT_AUTHORIZED.
 */
export const PAYPAL_SCOPES = [
  'https://uri.paypal.com/services/invoicing',
  'https://uri.paypal.com/services/applications/webhooks',
  // Orders v2 (Pay Later checkout + capture)
  'https://api.paypal.com/v1/payments/.*',
] as const;

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Retrieves an OAuth2 bearer token from PayPal with the scopes PulsePay needs.
 *
 * Important: PayPal's default client_credentials token does NOT include the
 * Invoicing scope, so we request the scopes explicitly on every token fetch.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set. ' +
        'PulsePay does not fall back to mock PayPal credentials.'
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: PAYPAL_SCOPES.join(' '),
    }).toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to obtain PayPal access token: ${res.status} ${errorText}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
  };

  if (!data.access_token) {
    throw new Error('PayPal token response did not include an access_token');
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };

  return cachedToken.token;
}

/** Clears the in-memory token cache (useful for scripts and tests). */
export function clearPayPalTokenCache(): void {
  cachedToken = null;
}

/**
 * Builds a PayPal Agent Toolkit instance that uses PulsePay's scoped token.
 *
 * The toolkit's own `getAccessToken()` only sends `grant_type=client_credentials`,
 * which lacks the Invoicing scope. We override it so every tool call uses the
 * token from `getPayPalAccessToken()`.
 */
export function getPayPalToolkit(): PayPalAgentToolkit {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set to use the Agent Toolkit.'
    );
  }

  const toolkit = new PayPalAgentToolkit({
    clientId,
    clientSecret,
    configuration: {
      actions: ALL_TOOLS_ENABLED,
      context: {
        sandbox: PAYPAL_IS_SANDBOX,
        debug: false,
        source: 'pulsepay',
      },
    },
  });

  // Force the toolkit to use our scoped token instead of its default token.
  (toolkit.client as unknown as { getAccessToken: () => Promise<string> }).getAccessToken =
    () => getPayPalAccessToken();

  return toolkit;
}

/**
 * Calls a PayPal Agent Toolkit tool by name and returns its parsed result.
 *
 * The toolkit reports API failures as `{ error: { message, type } }` instead of
 * throwing, so this helper turns them into real exceptions.
 */
export async function callPayPalTool<T = Record<string, unknown>>(
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const toolkit = getPayPalToolkit();

  const toolCall = {
    id: `pulsepay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'function' as const,
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };

  const message = (await toolkit.handleToolCall(toolCall as never)) as unknown as {
    content: string;
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(message.content);
  } catch {
    throw new Error(`PayPal tool ${name} returned non-JSON content: ${message.content}`);
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    (('error' in parsed) || (parsed as { ok?: boolean }).ok === false)
  ) {
    const failure = parsed as {
      error?: { message?: string; type?: string };
      message?: string;
      code?: string;
      status?: number;
    };
    const detail =
      failure.error?.message ??
      failure.message ??
      JSON.stringify(failure);
    throw new Error(`PayPal tool ${name} failed: ${detail}`);
  }

  return parsed as T;
}

export interface PayPalInvoicePage {
  invoices: PayPalInvoice[];
  totalPages: number;
  totalItems: number;
}

/**
 * Lists invoices from the PayPal merchant account.
 *
 * Throws on failure instead of silently returning an empty list: a failed
 * sync must be visible, not look like "the account has no invoices".
 */
export async function listPayPalInvoices(
  page = 1,
  pageSize = 20
): Promise<PayPalInvoicePage> {
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/invoicing/invoices?page=${page}&page_size=${pageSize}&total_required=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to list PayPal invoices: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    items?: PayPalInvoice[];
    total_pages?: number;
    total_items?: number;
  };

  return {
    invoices: data.items ?? [],
    totalPages: data.total_pages ?? 1,
    totalItems: data.total_items ?? data.items?.length ?? 0,
  };
}

/**
 * Fetches a single invoice, including its current status and links.
 */
export async function getPayPalInvoice(invoiceId: string): Promise<PayPalInvoice> {
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch PayPal invoice ${invoiceId}: ${res.status} ${await res.text()}`
    );
  }

  return (await res.json()) as PayPalInvoice;
}

/**
 * Creates an invoice in PayPal
 */
export async function createPayPalInvoice(
  payload: Record<string, unknown>
): Promise<{ id: string }> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to create PayPal invoice: ${await res.text()}`);
  }

  // PayPal returns the new invoice ID in the Location header and a self link
  // in the body. It does NOT return `{ id }`, so parse the header/body link.
  const location = res.headers.get('location');
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    href?: string;
  };

  const id =
    data.id ??
    location?.split('/').filter(Boolean).pop() ??
    data.href?.split('/').filter(Boolean).pop();

  if (!id) {
    throw new Error('PayPal created the invoice but did not return an invoice ID');
  }

  return { id };
}

export interface SendInvoiceResult {
  ok: boolean;
  payerLink?: string;
}

/**
 * Sends a PayPal invoice and returns the payer link from the send response.
 *
 * Important: PayPal returns the `payer-view` link on `send`, not on `get`.
 */
export async function sendPayPalInvoiceWithLink(
  invoiceId: string
): Promise<SendInvoiceResult> {
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ send_to_invoicer: false, send_to_recipient: true }),
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to send PayPal invoice ${invoiceId}: ${res.status} ${await res.text()}`
    );
  }

  const data = (await res.json().catch(() => ({}))) as {
    href?: string;
    rel?: string;
  };

  return {
    ok: true,
    payerLink: data.href,
  };
}

/**
 * Sends a PayPal invoice.
 */
export async function sendPayPalInvoice(invoiceId: string): Promise<boolean> {
  const result = await sendPayPalInvoiceWithLink(invoiceId);
  return result.ok;
}

/**
 * Cancels a sent PayPal invoice.
 *
 * Already-cancelled invoices are treated as success so retries stay
 * idempotent. A paid invoice is a real failure: it must not be superseded.
 */
export async function cancelPayPalInvoice(
  invoiceId: string,
  reason: string
): Promise<void> {
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'Invoice cancelled',
        note: reason,
        send_to_invoicer: false,
        send_to_recipient: true,
      }),
    }
  );

  if (res.ok) return;

  const body = await res.text();
  if (/ALREADY_CANCELLED|already cancelled/i.test(body)) {
    return;
  }

  throw new Error(
    `Failed to cancel PayPal invoice ${invoiceId}: ${res.status} ${body}`
  );
}

/**
 * Creates a native early-payment discount rule on an invoice.
 *
 * Note: some Sandbox accounts return 500 for this endpoint. Callers must be
 * prepared to fall back to void & reissue.
 */
export async function createEarlyPaymentDiscountRule(
  invoiceId: string,
  percent: number,
  endDate: string
): Promise<void> {
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/conditional-rules`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rules: [
          {
            conditional_rule_type: 'EARLY_PAYMENT_DISCOUNT',
            conditional_rule_value_type: 'PERCENT',
            conditional_rule_value: String(percent),
            rule_expiry_terms: {
              rule_expiry_condition: 'SPECIFIC_DATE',
              condition_rule_end_date: endDate,
            },
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to create discount rule on ${invoiceId}: ${res.status} ${await res.text()}`
    );
  }
}

export interface RecordPaymentOptions {
  method?: string;
  note?: string;
  currency?: string;
}

/**
 * Records an external payment on an invoice (e.g. a Pay Later order capture).
 */
export async function recordInvoicePayment(
  invoiceId: string,
  amount: number,
  options: RecordPaymentOptions = {}
): Promise<void> {
  const token = await getPayPalAccessToken();
  const currency = options.currency ?? 'USD';

  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/payments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: options.method ?? 'PAYPAL',
        payment_date: new Date().toISOString().split('T')[0],
        amount: { currency_code: currency, value: amount.toFixed(2) },
        ...(options.note ? { note: options.note } : {}),
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to record payment on ${invoiceId}: ${res.status} ${await res.text()}`
    );
  }
}
