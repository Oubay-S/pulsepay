// ============================================================
// PulsePay — PayPal Types
// Webhook events, invoice structures, API responses
// ============================================================

// ---------- Webhook Events ----------

export type PayPalWebhookEventType =
  | 'INVOICING.INVOICE.PAID'
  | 'INVOICING.INVOICE.CANCELLED'
  | 'INVOICING.INVOICE.REFUNDED'
  | 'INVOICING.INVOICE.UPDATED'
  | 'INVOICING.INVOICE.CREATED'
  | 'PAYMENT.CAPTURE.COMPLETED'
  | 'PAYMENT.CAPTURE.DENIED'
  | 'PAYMENT.CAPTURE.REFUNDED';

export interface PayPalWebhookEvent {
  id: string;
  event_version: string;
  create_time: string;
  resource_type: string;
  event_type: PayPalWebhookEventType;
  summary: string;
  resource: Record<string, unknown>;
  links: PayPalLink[];
}

export interface PayPalLink {
  href: string;
  rel: string;
  method: string;
}

// ---------- Webhook Verification ----------

export interface WebhookVerifyRequest {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  webhook_event: PayPalWebhookEvent;
}

export interface WebhookVerifyResponse {
  verification_status: 'SUCCESS' | 'FAILURE';
}

// ---------- Invoice ----------

export interface PayPalInvoice {
  id: string;
  status: string;
  detail: {
    invoice_number?: string;
    invoice_date?: string;
    payment_term?: {
      due_date?: string;
    };
    currency_code: string;
    memo?: string;
    note?: string;
  };
  invoicer?: {
    name?: { given_name?: string; surname?: string };
    email_address?: string;
    business_name?: string;
  };
  primary_recipients?: Array<{
    billing_info?: {
      name?: { given_name?: string; surname?: string };
      email_address?: string;
    };
  }>;
  items?: Array<{
    name: string;
    description?: string;
    quantity: string;
    unit_amount: { currency_code: string; value: string };
  }>;
  amount?: {
    currency_code: string;
    value: string;
    breakdown?: {
      item_total?: { currency_code: string; value: string };
      discount?: { invoice_discount?: { percent?: string; amount?: { currency_code: string; value: string } } };
    };
  };
  due_amount?: { currency_code: string; value: string };
  payments?: {
    paid_amount?: { currency_code: string; value: string };
    transactions?: Array<{
      payment_id: string;
      payment_date: string;
      method: string;
      amount: { currency_code: string; value: string };
    }>;
  };
  links?: PayPalLink[];
}

// ---------- Auth ----------

export interface PayPalAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// ---------- Orders (for Pay Later) ----------

export interface PayPalOrder {
  id: string;
  status: string;
  intent: string;
  purchase_units: Array<{
    reference_id: string;
    amount: {
      currency_code: string;
      value: string;
    };
    description?: string;
  }>;
  payment_source?: Record<string, unknown>;
  links?: PayPalLink[];
}

/**
 * Orders v2 create/capture response. The fields are optional because PayPal
 * returns a different subset for create, get, and capture.
 */
export interface PayPalOrderResponse {
  id: string;
  status: string;
  intent?: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    description?: string;
    amount?: {
      currency_code: string;
      value: string;
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        custom_id?: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
  payer?: {
    email_address?: string;
    payer_id?: string;
    name?: {
      given_name?: string;
      surname?: string;
    };
  };
  links?: PayPalLink[];
}

// ---------- Conditional Rules ----------

export interface PayPalConditionalRule {
  discount?: {
    percent?: string;
    amount?: { currency_code: string; value: string };
  };
  terms?: string;
}

