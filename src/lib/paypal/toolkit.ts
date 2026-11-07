// ============================================================
// PulsePay — PayPal API & Toolkit Wrapper
// Handles PayPal Invoicing v2, Orders v2, and webhook operations
// ============================================================

import type { PayPalInvoice, PayPalOrder } from '@/types/paypal';

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Retrieves OAuth2 bearer access token from PayPal Sandbox
 */
function isPlaceholderCredential(value: string | undefined): boolean {
  const normalized = (value || '').trim().toLowerCase();
  return (
    !normalized ||
    normalized.startsWith('your') ||
    normalized.startsWith('placeholder') ||
    normalized === 'sandbox_mock'
  );
}

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  // The hackathon seed uses demo invoice IDs that do not exist in PayPal.
  // Mock mode keeps the full agreement flow demoable until real Sandbox
  // invoices are seeded (set PAYPAL_MOCK_MODE=true to force it).
  if (
    process.env.PAYPAL_MOCK_MODE === 'true' ||
    isPlaceholderCredential(clientId) ||
    isPlaceholderCredential(clientSecret)
  ) {
    return 'sandbox_mock_access_token';
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
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to obtain PayPal access token: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };

  return cachedToken.token;
}

/**
 * Lists invoices from PayPal merchant account
 */
export async function listPayPalInvoices(page = 1, pageSize = 20): Promise<{ invoices: PayPalInvoice[] }> {
  try {
    const token = await getPayPalAccessToken();
    if (token === 'sandbox_mock_access_token') {
      return { invoices: [] };
    }

    const res = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices?page=${page}&page_size=${pageSize}&total_required=true`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return { invoices: [] };
    }

    const data = await res.json();
    return { invoices: data.items || [] };
  } catch {
    return { invoices: [] };
  }
}

/**
 * Creates an invoice in PayPal
 */
export async function createPayPalInvoice(payload: Record<string, unknown>): Promise<{ id: string }> {
  const token = await getPayPalAccessToken();
  if (token === 'sandbox_mock_access_token') {
    return { id: `MOCK-INV-${Date.now()}` };
  }

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

  const data = await res.json();
  return { id: data.id };
}

/**
 * Sends a PayPal invoice
 */
export async function sendPayPalInvoice(invoiceId: string): Promise<boolean> {
  const token = await getPayPalAccessToken();
  if (token === 'sandbox_mock_access_token') {
    return true;
  }

  const res = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ send_to_invoicer: false }),
  });

  return res.ok;
}

/**
 * Cancels a sent PayPal invoice
 */
export async function cancelPayPalInvoice(invoiceId: string, reason: string): Promise<boolean> {
  const token = await getPayPalAccessToken();
  if (token === 'sandbox_mock_access_token') {
    return true;
  }

  const res = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}/cancel`, {
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
  });

  return res.ok;
}

/**
 * Records an external payment on an invoice (e.g. When client paid via Pay Later order)
 */
export async function recordPayPalPayment(
  invoiceId: string,
  amount: number,
  method = 'PAYPAL'
): Promise<boolean> {
  const token = await getPayPalAccessToken();
  if (token === 'sandbox_mock_access_token') {
    return true;
  }

  const res = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method,
      payment_date: new Date().toISOString().split('T')[0],
      amount: { currency_code: 'USD', value: amount.toFixed(2) },
    }),
  });

  return res.ok;
}

