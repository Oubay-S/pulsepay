// ============================================================
// PulsePay — Pay Later: create order
//
// The client page calls this from the PayPal JS SDK `createOrder`
// callback. The order carries the PulsePay invoice UUID in
// `purchase_units[0].custom_id`, so the capture webhook can map the
// payment back to the invoice without a schema change.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPayPalOrder } from '@/lib/paypal/toolkit';

export const maxDuration = 60;

interface InvoiceForOrder {
  id: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  business: { name: string; currency: string } | { name: string; currency: string }[] | null;
}

function firstOrSelf<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const supabase = createAdminClient();

    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('id, invoice:invoices(*, business:businesses(name, currency))')
      .eq('token', token)
      .single();

    if (error || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const invoice = firstOrSelf(
      conversation.invoice as InvoiceForOrder | InvoiceForOrder[] | null
    );

    if (!invoice) {
      return NextResponse.json({ error: 'Conversation has no invoice' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({
        already_paid: true,
        invoice_status: 'PAID',
      });
    }

    if (invoice.status !== 'SENT') {
      return NextResponse.json(
        {
          error: `Pay Later is not available for an invoice in status ${invoice.status}`,
        },
        { status: 400 }
      );
    }

    const amount = Number(invoice.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invoice has no payable amount' }, { status: 400 });
    }

    const business = firstOrSelf(invoice.business);

    const order = await createPayPalOrder(
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            // The webhook handler maps PAYMENT.CAPTURE.COMPLETED with this.
            custom_id: invoice.id,
            description: (invoice.description || 'Invoice payment').slice(0, 127),
            amount: {
              currency_code: invoice.currency || 'USD',
              value: amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: (business?.name || 'PulsePay').slice(0, 127),
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      },
      `pulsepay-paylater-${invoice.id}`
    );

    const approveLink =
      order.links?.find(
        (link) => link.rel === 'payer-action' || link.rel === 'approve'
      )?.href ?? null;

    return NextResponse.json({
      id: order.id,
      status: order.status,
      approve_link: approveLink,
      amount,
      currency: invoice.currency || 'USD',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to create Pay Later order: ${message}` },
      { status: 502 }
    );
  }
}
