// ============================================================
// PulsePay — PayPal Webhook Verification
// Uses PayPal's official verify-webhook-signature API.
//
// There is no implicit development bypass: a missing signature is
// rejected unless PAYPAL_WEBHOOK_SKIP_VERIFY is explicitly "true".
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

export function readWebhookHeaders(headers: Headers): WebhookHeaderBundle {
  return {
    authAlgo: headers.get('paypal-auth-algo'),
    certUrl: headers.get('paypal-cert-url'),
    transmissionId: headers.get('paypal-transmission-id'),
    transmissionSig: headers.get('paypal-transmission-sig'),
    transmissionTime: headers.get('paypal-transmission-time'),
  };
}

/**
 * Validates the cryptographic signature of a PayPal webhook event using
 * PayPal's server-side verification endpoint.
 *
 * Returns false for any missing transmission header, missing webhook ID,
 * network failure or non-SUCCESS verification status.
 */
export async function verifyWebhookSignature(
  headers: Headers,
  rawBody: string,
  webhookId: string = process.env.PAYPAL_WEBHOOK_ID || ''
): Promise<boolean> {
  // Explicit, documented escape hatch for local experiments only.
  if (process.env.PAYPAL_WEBHOOK_SKIP_VERIFY === 'true') {
    console.warn(
      'PAYPAL_WEBHOOK_SKIP_VERIFY=true — webhook signature verification is disabled'
    );
    return true;
  }

  const bundle = readWebhookHeaders(headers);

  if (
    !bundle.authAlgo ||
    !bundle.certUrl ||
    !bundle.transmissionId ||
    !bundle.transmissionSig ||
    !bundle.transmissionTime
  ) {
    return false;
  }

  if (!webhookId) {
    console.error('PAYPAL_WEBHOOK_ID is not set; cannot verify webhook signature');
    return false;
  }

  let parsedEvent: Record<string, unknown>;
  try {
    parsedEvent = JSON.parse(rawBody);
  } catch {
    return false;
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const payload = {
      auth_algo: bundle.authAlgo,
      cert_url: bundle.certUrl,
      transmission_id: bundle.transmissionId,
      transmission_sig: bundle.transmissionSig,
      transmission_time: bundle.transmissionTime,
      webhook_id: webhookId,
      webhook_event: parsedEvent,
    };

    const res = await fetch(
      `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      console.error(
        `PayPal webhook verification failed: ${res.status} ${await res.text()}`
      );
      return false;
    }

    const data = (await res.json()) as { verification_status?: string };
    return data.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('Error verifying webhook signature:', err);
    return false;
  }
}
