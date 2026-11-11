import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPartialInvoicePayment,
  unwrapInvoiceResource,
} from '../invoice-payment';

describe('PayPal invoice payment classification', () => {
  it('treats PARTIALLY_PAID as a partial payment', () => {
    assert.equal(
      isPartialInvoicePayment({ status: 'PARTIALLY_PAID', paidAmount: 1000, totalAmount: 2800 }),
      true
    );
  });

  it('treats PARTIALLY_REFUNDED as a partial payment', () => {
    assert.equal(isPartialInvoicePayment({ status: 'PARTIALLY_REFUNDED' }), true);
  });

  it('treats PAID with the full amount as a full payment', () => {
    assert.equal(
      isPartialInvoicePayment({ status: 'PAID', paidAmount: 850, totalAmount: 850 }),
      false
    );
  });

  it('uses the amounts when the payload has no status', () => {
    assert.equal(isPartialInvoicePayment({ paidAmount: 1000, totalAmount: 2800 }), true);
    assert.equal(isPartialInvoicePayment({ paidAmount: 2800, totalAmount: 2800 }), false);
  });

  it('defaults to full when the payload has no usable amounts', () => {
    assert.equal(isPartialInvoicePayment({}), false);
    assert.equal(isPartialInvoicePayment({ paidAmount: Number.NaN }), false);
  });

  it('unwraps the invoice when PayPal nests it under resource.invoice', () => {
    const nested = { id: 'INV2-TEST', status: 'PARTIALLY_PAID' };
    assert.deepEqual(unwrapInvoiceResource({ invoice: nested }), nested);
    assert.deepEqual(unwrapInvoiceResource({ id: 'INV2-TEST' }), { id: 'INV2-TEST' });
  });
});
