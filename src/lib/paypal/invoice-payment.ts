// ============================================================
// PulsePay — PayPal invoice payment classification
//
// `INVOICING.INVOICE.PAID` fires for full payments, partial payments,
// and pending payments. Treat only a full payment as `PAID`: a partial
// payment must never resolve a conversation or close an installment.
// ============================================================

export interface InvoicePaymentSnapshot {
  status?: string | null;
  paidAmount?: number;
  totalAmount?: number;
}

/**
 * PayPal nests the invoice under `resource.invoice` in some payload
 * variants and puts it directly on `resource` in others.
 */
export function unwrapInvoiceResource(
  resource: Record<string, unknown>
): Record<string, unknown> {
  const nested = resource.invoice;
  return nested !== null && typeof nested === 'object'
    ? (nested as Record<string, unknown>)
    : resource;
}

export function isPartialInvoicePayment(snapshot: InvoicePaymentSnapshot): boolean {
  const { status, paidAmount, totalAmount } = snapshot;

  if (status === 'PARTIALLY_PAID' || status === 'PARTIALLY_REFUNDED') {
    return true;
  }

  return (
    typeof paidAmount === 'number' &&
    Number.isFinite(paidAmount) &&
    typeof totalAmount === 'number' &&
    Number.isFinite(totalAmount) &&
    paidAmount > 0 &&
    paidAmount < totalAmount
  );
}
