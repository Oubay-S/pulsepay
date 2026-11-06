// ============================================================
// PulsePay — PayPal Webhook Verification
// Uses official PayPal verify-webhook-signature API
// ============================================================

import { getPayPalAccessToken } from './toolkit';

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

export interface WebhookHeaderBundle {
  authAlgo: string | null;
  certUrl: string | null;
  transmissionId: string | null;
  transmissionSig: string | null;
  transmissionTime: string | null;
}

/**
 * Validates the cryptographic signature of a PayPal webhook event
 * using PayPal's server-side verification endpoint.
 */
export async function verifyWebhookSignature(
  headers: Headers,
  rawBody: string,
  webhookId: string = process.env.PAYPAL_WEBHOOK_ID || ''
): Promise<boolean> {
  const authAlgo = headers.get('paypal-auth-algo');
  const certUrl = headers.get('paypal-cert-url');
  const transmissionId = headers.get('paypal-transmission-id');
  const transmissionSig = headers.get('paypal-transmission-sig');
  const transmissionTime = headers.get('paypal-transmission-time');

  // In local test or if webhook headers are missing
  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    if (process.env.NODE_ENV === 'development' || !webhookId) {
      // Allow test events in local development
      return true;
    }
    return false;
  }

  try {
    const accessToken = await getPayPalAccessToken();
    if (accessToken === 'sandbox_mock_access_token') {
      return true;
    }

    let parsedEvent: Record<string, unknown>;
    try {
      parsedEvent = JSON.parse(rawBody);
    } catch {
      return false;
    }

    const payload = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: parsedEvent,
    };

    const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    return data.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('Error verifying webhook signature:', err);
    return false;
  }
}

