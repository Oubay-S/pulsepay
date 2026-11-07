// ============================================================
// PulsePay — Client Portal Normalizer
// Converts the token API payload into safe view models.
// The API can evolve (or return a legacy arrangement shape) without
// breaking the client page.
// ============================================================

import type {
  ArrangementStatus,
  ArrangementType,
  ConversationStatus,
  InstallmentRow,
  InstallmentStatus,
  InvoiceStatus,
  MessageRow,
  MessageSender,
} from '@/types/database';
import { roundMoney } from './format';
import type {
  ClientPortalData,
  ClientPortalInvoice,
  ClientPortalOffer,
  ClientPortalPayable,
  ClientPortalPayLater,
  OfferView,
  PlanInstallmentView,
} from './types';

const DAY_MS = 86_400_000;

const ARRANGEMENT_STATUSES: ArrangementStatus[] = [
  'PROPOSED',
  'PENDING_APPROVAL',
  'ACCEPTED',
  'REJECTED',
  'EXECUTED',
  'EXPIRED',
];

const CONVERSATION_STATUSES: ConversationStatus[] = [
  'ACTIVE',
  'RESOLVED',
  'ESCALATED',
  'DISPUTED',
];

const INVOICE_STATUSES: InvoiceStatus[] = [
  'DRAFT',
  'SENT',
  'PAID',
  'CANCELLED',
  'SUPERSEDED',
  'PARTIALLY_PAID',
  'SCHEDULED',
];

const SENDERS: MessageSender[] = ['AGENT', 'CLIENT', 'OWNER', 'SYSTEM'];

const INSTALLMENT_STATUSES: InstallmentStatus[] = ['SCHEDULED', 'SENT', 'PAID', 'CANCELLED'];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asIso(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isOneOf<T extends string>(value: string | null, options: T[]): value is T {
  return value !== null && options.includes(value as T);
}

function sanitizeInstallment(raw: unknown): InstallmentRow | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = asString(record.id);
  const arrangementId = asString(record.arrangement_id);
  const number = asNumber(record.number);
  const amount = asNumber(record.amount);
  const dueDate = asIso(record.due_date);

  if (!id || !arrangementId || number === null || amount === null || !dueDate) return null;

  const status = asString(record.status);
  return {
    id,
    arrangement_id: arrangementId,
    number,
    amount,
    due_date: dueDate,
    paypal_invoice_id: asString(record.paypal_invoice_id),
    status: isOneOf(status, INSTALLMENT_STATUSES) ? status : 'SCHEDULED',
    paid_at: asIso(record.paid_at),
    created_at: asIso(record.created_at) ?? new Date(0).toISOString(),
  };
}

function sanitizeOffer(raw: unknown): ClientPortalOffer | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = asString(record.id);
  const invoiceId = asString(record.invoice_id);
  const type = asString(record.type);
  const createdAt = asIso(record.created_at);
  if (!id || !invoiceId || !type || !createdAt) return null;

  const status = asString(record.status);

  return {
    id,
    invoice_id: invoiceId,
    conversation_id: asString(record.conversation_id),
    type: type.toUpperCase() as ArrangementType,
    terms: asRecord(record.terms) ?? {},
    status: isOneOf(status, ARRANGEMENT_STATUSES) ? status : 'PROPOSED',
    approved_by: asString(record.approved_by),
    rejection_reason: asString(record.rejection_reason),
    created_at: createdAt,
    updated_at: asIso(record.updated_at) ?? createdAt,
    installments: asArray(record.installments)
      .map(sanitizeInstallment)
      .filter((item): item is InstallmentRow => item !== null),
  };
}

function sanitizeMessage(raw: unknown, fallbackConversationId: string): MessageRow | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = asString(record.id);
  const content = asString(record.content);
  const createdAt = asIso(record.created_at);
  const sender = asString(record.sender);

  if (!id || !content || !createdAt || !isOneOf(sender, SENDERS)) return null;

  return {
    id,
    conversation_id: asString(record.conversation_id) ?? fallbackConversationId,
    sender,
    content,
    intent: asString(record.intent),
    metadata: asRecord(record.metadata),
    created_at: createdAt,
  };
}

function sanitizePayable(raw: unknown): ClientPortalPayable | null {
  const record = asRecord(raw);
  if (!record) return null;

  const paypalInvoiceId = asString(record.paypal_invoice_id);
  const payerLink = asString(record.payer_link);
  const amount = asNumber(record.amount);
  const currency = asString(record.currency);
  const status = asString(record.status);
  const kind = asString(record.kind);

  if (
    !paypalInvoiceId ||
    !payerLink ||
    amount === null ||
    !currency ||
    !status ||
    (kind !== 'invoice' && kind !== 'installment')
  ) {
    return null;
  }

  return {
    paypalInvoiceId,
    payerLink,
    amount,
    currency,
    status,
    kind,
    installmentNumber: asNumber(record.installment_number) ?? undefined,
  };
}

function sanitizePayLater(
  raw: unknown,
  fallbackAmount: number,
  fallbackCurrency: string
): ClientPortalPayLater {
  const record = asRecord(raw);

  if (!record) {
    return {
      available: false,
      amount: fallbackAmount,
      currency: fallbackCurrency,
      createUrl: '',
      captureUrl: '',
    };
  }

  return {
    available: record.available === true,
    amount: asNumber(record.amount) ?? fallbackAmount,
    currency: asString(record.currency) ?? fallbackCurrency,
    createUrl: asString(record.create_url) ?? '',
    captureUrl: asString(record.capture_url) ?? '',
  };
}

export function normalizeClientPortalData(raw: unknown): ClientPortalData {
  const record = asRecord(raw) ?? {};
  const invoiceRecord = asRecord(record.invoice) ?? {};

  const conversationId = asString(record.conversation_id) ?? '';
  const status = asString(record.status);
  const invoiceStatus = asString(invoiceRecord.status);
  const invoice: ClientPortalInvoice = {
    id: asString(invoiceRecord.id) ?? '',
    number: asString(invoiceRecord.paypal_invoice_id) ?? 'Invoice',
    amount: asNumber(invoiceRecord.amount) ?? 0,
    currency: asString(invoiceRecord.currency) ?? 'USD',
    dueDate: asIso(invoiceRecord.due_date) ?? new Date().toISOString(),
    description: asString(invoiceRecord.description),
    status: isOneOf(invoiceStatus, INVOICE_STATUSES) ? invoiceStatus : 'SENT',
  };

  return {
    conversationId,
    status: isOneOf(status, CONVERSATION_STATUSES) ? status : 'ACTIVE',
    businessName: asString(record.business_name) ?? 'Your invoice',
    clientName: asString(record.client_name),
    businessTone: asString(record.business_tone),
    demoNow: asIso(record.demo_now) ?? new Date().toISOString(),
    invoice,
    payable: sanitizePayable(record.payable),
    paylater: sanitizePayLater(record.paylater, invoice.amount, invoice.currency),
    messages: asArray(record.messages)
      .map((message) => sanitizeMessage(message, conversationId))
      .filter((message): message is MessageRow => message !== null),
    offers: asArray(record.offers)
      .map(sanitizeOffer)
      .filter((offer): offer is ClientPortalOffer => offer !== null),
  };
}

export function isInvoicePayable(status: InvoiceStatus): boolean {
  return status === 'SENT' || status === 'PARTIALLY_PAID' || status === 'SCHEDULED';
}

function mergeInstallments(
  schedule: PlanInstallmentView[],
  stored: InstallmentRow[]
): PlanInstallmentView[] {
  const byNumber = new Map(stored.map((item) => [item.number, item]));

  return schedule.map((item) => {
    const match = byNumber.get(item.number);
    return match
      ? {
          number: item.number,
          amount: match.amount,
          dueDate: match.due_date,
          status: match.status,
          paidAt: match.paid_at,
        }
      : item;
  });
}

function planFromTerms(
  terms: Record<string, unknown>,
  createdAt: string,
  stored: InstallmentRow[]
): PlanInstallmentView[] | null {
  const rawSchedule = asArray(terms.installments);
  const schedule: PlanInstallmentView[] = [];

  for (const raw of rawSchedule) {
    const item = asRecord(raw);
    if (!item) continue;

    const number = asNumber(item.number);
    const amount = asNumber(item.amount);
    const dueDate = asIso(item.due_date);
    if (number === null || number <= 0 || amount === null || amount <= 0 || !dueDate) continue;

    schedule.push({ number, amount, dueDate });
  }

  if (schedule.length >= 2) {
    return mergeInstallments(
      schedule.sort((a, b) => a.number - b.number),
      stored
    );
  }

  if (stored.length >= 2) {
    return stored
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((item) => ({
        number: item.number,
        amount: item.amount,
        dueDate: item.due_date,
        status: item.status,
        paidAt: item.paid_at,
      }));
  }

  // Legacy seed shape: { installments: 3, first_amount, installment_amount }
  const count = asNumber(terms.installments);
  if (count === null || count < 2) return null;

  const firstAmount = asNumber(terms.first_amount);
  const recurringAmount = asNumber(terms.installment_amount);
  const totalAmount = asNumber(terms.total_amount);

  const fallbackAmount =
    recurringAmount ??
    (totalAmount !== null ? roundMoney(totalAmount / count) : 0);

  const built: PlanInstallmentView[] = [];
  for (let index = 0; index < count; index += 1) {
    const amount = index === 0 ? (firstAmount ?? fallbackAmount) : fallbackAmount;
    if (amount <= 0) return null;

    built.push({
      number: index + 1,
      amount,
      dueDate: new Date(Date.parse(createdAt) + index * 30 * DAY_MS).toISOString(),
    });
  }

  return built;
}

function toOfferView(raw: unknown, invoice: ClientPortalInvoice): OfferView | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = asString(record.id);
  const status = asString(record.status);
  const createdAt = asIso(record.created_at);
  const type = (asString(record.type) ?? '').toUpperCase();
  const terms = asRecord(record.terms) ?? {};

  if (!id || !createdAt || !isOneOf(status, ARRANGEMENT_STATUSES)) return null;
  if (!['PROPOSED', 'PENDING_APPROVAL', 'ACCEPTED', 'EXECUTED'].includes(status)) return null;

  const accepted = status === 'ACCEPTED' || status === 'EXECUTED';
  const awaitingApproval = status === 'PENDING_APPROVAL';
  const canAcceptBase = status === 'PROPOSED' && isInvoicePayable(invoice.status);

  const storedInstallments = asArray(record.installments)
    .map(sanitizeInstallment)
    .filter((item): item is InstallmentRow => item !== null);

  const base = {
    id,
    status,
    createdAt,
    canAccept: false,
    awaitingApproval,
    accepted,
  };

  if (type === 'PAY_LATER' || terms.type === 'pay_later') {
    return {
      ...base,
      kind: 'pay_later',
      amount: asNumber(terms.invoice_amount) ?? invoice.amount,
    };
  }

  if (type === 'PLAN' || terms.type === 'plan') {
    const schedule = planFromTerms(terms, createdAt, storedInstallments);
    if (schedule && schedule.length >= 2) {
      const totalAmount = roundMoney(schedule.reduce((sum, item) => sum + item.amount, 0));
      return {
        ...base,
        kind: 'plan',
        installments: schedule,
        totalAmount,
        canAccept: canAcceptBase,
      };
    }

    return {
      ...base,
      kind: 'request',
      reason:
        asString(terms.reason) ??
        'A custom payment plan is waiting for review by the business owner.',
    };
  }

  if (type === 'DISCOUNT' || terms.type === 'discount') {
    const discountPct = asNumber(terms.discount_pct) ?? asNumber(terms.requested_discount_pct);
    const deadlineHours = asNumber(terms.deadline_hours);
    const validProposal =
      terms.type === 'discount' &&
      discountPct !== null &&
      discountPct > 0 &&
      discountPct <= 100 &&
      deadlineHours !== null &&
      deadlineHours > 0;

    if (validProposal && discountPct !== null && deadlineHours !== null) {
      const discountedAmount =
        asNumber(terms.discounted_amount) ?? roundMoney(invoice.amount * (1 - discountPct / 100));
      const createdTime = Date.parse(createdAt);

      return {
        ...base,
        kind: 'discount',
        discountPct,
        deadlineHours,
        originalAmount: invoice.amount,
        discountedAmount,
        savings: roundMoney(Math.max(0, invoice.amount - discountedAmount)),
        deadlineDate: new Date(createdTime + deadlineHours * 3_600_000).toISOString(),
        canAccept: canAcceptBase,
      };
    }

    const requestedPct =
      discountPct !== null && discountPct > 0 && discountPct <= 100 ? discountPct : undefined;
    const requestedAmount =
      asNumber(terms.discounted_amount) ??
      (requestedPct !== undefined
        ? roundMoney(invoice.amount * (1 - requestedPct / 100))
        : undefined);

    return {
      ...base,
      kind: 'request',
      requestedDiscountPct: requestedPct,
      requestedAmount,
      reason:
        asString(terms.reason) ??
        'A custom discount request is waiting for review by the business owner.',
    };
  }

  const reason = asString(terms.reason);
  if (reason) {
    return {
      ...base,
      kind: 'request',
      reason,
    };
  }

  return null;
}

function offerRank(offer: OfferView): number {
  if (offer.accepted) return 0;
  if (offer.kind === 'plan' || offer.kind === 'discount') return offer.awaitingApproval ? 3 : 1;
  if (offer.kind === 'pay_later') return 2;
  return 3;
}

export function normalizeOffers(rawOffers: unknown, invoice: ClientPortalInvoice): OfferView[] {
  const views = asArray(rawOffers)
    .map((offer) => toOfferView(offer, invoice))
    .filter((offer): offer is OfferView => offer !== null);

  views.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  // Keep the newest offer of each kind. Duplicate proposals are common
  // when a client sends several negotiation messages.
  const latestByKind = new Map<string, OfferView>();
  for (const view of views) {
    if (!latestByKind.has(view.kind)) latestByKind.set(view.kind, view);
  }

  let result = Array.from(latestByKind.values());

  // Once a settlement is active, hide duplicate proposals and the
  // informational Pay Later card, but keep owner requests visible.
  const hasAcceptedSettlement = result.some(
    (offer) => offer.accepted && (offer.kind === 'plan' || offer.kind === 'discount')
  );

  if (hasAcceptedSettlement) {
    result = result.filter((offer) => offer.accepted || offer.kind === 'request');
  }

  return result.sort((a, b) => {
    const rankDiff = offerRank(a) - offerRank(b);
    if (rankDiff !== 0) return rankDiff;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}
