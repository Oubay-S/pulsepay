import type { NegotiationProposal } from '@/types/proposals';
import type { InvoiceStatus, PolicyRow } from '@/types/database';
import type { ApprovalArrangement } from './types';

export type RequestKind = 'discount' | 'plan' | 'pay_later' | 'custom';

export interface RequestView {
  kind: RequestKind;
  requestedDiscountPct?: number;
  requestedAmount?: number;
  reason?: string;
  executable: boolean;
  proposal: NegotiationProposal | null;
}

const PAYABLE_STATUSES: InvoiceStatus[] = ['SENT', 'PARTIALLY_PAID', 'SCHEDULED'];

export function isInvoicePayable(status: InvoiceStatus): boolean {
  return PAYABLE_STATUSES.includes(status);
}

export function isDispute(approval: ApprovalArrangement): boolean {
  return approval.conversation?.status === 'DISPUTED';
}

export function readTerms(approval: ApprovalArrangement): Record<string, unknown> {
  return approval.terms && typeof approval.terms === 'object' ? approval.terms : {};
}

export function describeRequest(approval: ApprovalArrangement): RequestView {
  const terms = readTerms(approval);
  const type = typeof terms.type === 'string' ? terms.type : null;

  if (type === 'discount') {
    const pct = typeof terms.discount_pct === 'number' ? terms.discount_pct : undefined;
    const deadline =
      typeof terms.deadline_hours === 'number' ? terms.deadline_hours : undefined;

    if (pct !== undefined && deadline !== undefined) {
      return {
        kind: 'discount',
        requestedDiscountPct: pct,
        executable: true,
        proposal: terms as unknown as NegotiationProposal,
      };
    }
  }

  if (type === 'plan' && Array.isArray(terms.installments)) {
    const installments = terms.installments as unknown[];
    if (installments.length >= 2) {
      return {
        kind: 'plan',
        executable: true,
        proposal: terms as unknown as NegotiationProposal,
      };
    }
  }

  if (type === 'pay_later') {
    return {
      kind: 'pay_later',
      executable: true,
      proposal: terms as unknown as NegotiationProposal,
    };
  }

  const requestedPct =
    typeof terms.requested_discount_pct === 'number'
      ? terms.requested_discount_pct
      : typeof terms.discount_pct === 'number'
        ? terms.discount_pct
        : undefined;

  const requestedAmount =
    typeof terms.discounted_amount === 'number' ? terms.discounted_amount : undefined;

  return {
    kind: requestedPct !== undefined ? 'discount' : 'custom',
    requestedDiscountPct: requestedPct,
    requestedAmount,
    reason: typeof terms.reason === 'string' ? terms.reason : undefined,
    executable: false,
    proposal: null,
  };
}

export function defaultCounterDiscount(
  approval: ApprovalArrangement,
  maxDiscountPct: number
): number {
  const request = describeRequest(approval);
  const requested = request.requestedDiscountPct;

  if (requested !== undefined && requested > 0) {
    return Math.min(Math.round(requested), Math.max(0.5, maxDiscountPct));
  }

  return Math.max(0.5, maxDiscountPct);
}

export function counterAmount(invoiceAmount: number, discountPct: number): number {
  return Math.round(invoiceAmount * (1 - discountPct / 100) * 100) / 100;
}

export function explainApproval(
  approval: ApprovalArrangement,
  policy: PolicyRow | null
): string {
  if (isDispute(approval)) {
    return 'The client disputed the work. Automation is paused until you review the claim.';
  }

  const invoice = approval.invoice;
  const maxDiscount = Number(policy?.max_discount_pct ?? 10);
  const maxInstallments = Number(policy?.max_installments ?? 3);
  const minFirstPct = Number(policy?.min_first_payment_pct ?? 30);
  const threshold = Number(policy?.approval_threshold ?? 2000);
  const request = describeRequest(approval);

  if (invoice.amount >= threshold) {
    return `This invoice is at or above your $${threshold.toLocaleString(
      'en-US'
    )} approval threshold.`;
  }

  if (
    request.requestedDiscountPct !== undefined &&
    request.requestedDiscountPct > maxDiscount
  ) {
    return `The requested ${request.requestedDiscountPct}% discount is above your ${maxDiscount}% limit.`;
  }

  if (request.kind === 'plan' && request.proposal?.type === 'plan') {
    const plan = request.proposal;
    if (plan.installments.length > maxInstallments) {
      return `The plan asks for ${plan.installments.length} installments; your limit is ${maxInstallments}.`;
    }

    const firstPct = (plan.installments[0].amount / invoice.amount) * 100;
    if (firstPct < minFirstPct) {
      return `The first payment is ${firstPct.toFixed(1)}% of the invoice; your minimum is ${minFirstPct}%.`;
    }
  }

  if (!request.executable) {
    return 'The client asked for custom terms the assistant cannot execute on its own.';
  }

  return 'This request falls outside the assistant’s policy.';
}

export function buildPlanCounter(params: {
  invoiceAmount: number;
  installments: number;
  firstAmount: number;
  firstDueDate: string;
}): NegotiationProposal {
  const count = Math.max(2, Math.round(params.installments));
  const first = Math.round(params.firstAmount * 100) / 100;
  const remaining = Math.max(0, params.invoiceAmount - first);
  const base = Math.round((remaining / (count - 1)) * 100) / 100;
  const amounts: number[] = [];

  for (let index = 0; index < count - 1; index += 1) {
    amounts.push(base);
  }

  const allocated = amounts.reduce((sum, amount) => sum + amount, 0);
  const adjustment = Math.round((remaining - allocated) * 100) / 100;
  if (amounts.length > 0) {
    amounts[amounts.length - 1] = Math.round((amounts[amounts.length - 1] + adjustment) * 100) / 100;
  }

  const firstDate = new Date(params.firstDueDate);

  return {
    type: 'plan',
    installments: [first, ...amounts].map((amount, index) => ({
      number: index + 1,
      amount,
      due_date: new Date(firstDate.getTime() + index * 30 * 86_400_000).toISOString(),
    })),
  };
}
