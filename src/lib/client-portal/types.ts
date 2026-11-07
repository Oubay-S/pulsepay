// ============================================================
// PulsePay — Client Portal View Types
// Raw API payloads are normalized into these view models before
// they reach the UI, so unexpected JSON cannot crash the page.
// ============================================================

import type {
  ArrangementRow,
  ArrangementStatus,
  ConversationStatus,
  InstallmentRow,
  InstallmentStatus,
  InvoiceStatus,
  MessageRow,
} from '@/types/database';

export interface ClientPortalInvoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  dueDate: string;
  description: string | null;
  status: InvoiceStatus;
}

export interface ClientPortalPayable {
  paypalInvoiceId: string;
  payerLink: string;
  amount: number;
  currency: string;
  status: string;
  kind: 'invoice' | 'installment';
  installmentNumber?: number;
}

export interface ClientPortalPayLater {
  available: boolean;
  amount: number;
  currency: string;
  createUrl: string;
  captureUrl: string;
}

export interface ClientPortalData {
  conversationId: string;
  status: ConversationStatus;
  businessName: string;
  clientName: string | null;
  businessTone: string | null;
  demoNow: string;
  invoice: ClientPortalInvoice;
  payable: ClientPortalPayable | null;
  paylater: ClientPortalPayLater;
  messages: MessageRow[];
  offers: ClientPortalOffer[];
}

export interface ClientPortalLoadFailure {
  kind: 'not_found' | 'error';
  message: string;
}

// The token API payload. Kept separate from the view model so the
// server page and the polling route can share one query.
export interface ClientPortalPayload {
  conversation_id: string;
  status: string;
  business_name: string;
  client_name: string | null;
  business_tone: string | null;
  demo_now: string;
  invoice: {
    id: string;
    paypal_invoice_id: string;
    amount: number;
    currency: string;
    due_date: string;
    description: string | null;
    status: string;
  };
  payable: {
    paypal_invoice_id: string;
    payer_link: string;
    amount: number;
    currency: string;
    status: string;
    kind: 'invoice' | 'installment';
    installment_number?: number;
  } | null;
  paylater: {
    available: boolean;
    amount: number;
    currency: string;
    create_url: string;
    capture_url: string;
  };
  messages: MessageRow[];
  offers: ClientPortalOffer[];
}

export interface ClientPortalOffer extends ArrangementRow {
  installments?: InstallmentRow[] | null;
}

export interface OfferViewBase {
  id: string;
  status: ArrangementStatus;
  createdAt: string;
  canAccept: boolean;
  awaitingApproval: boolean;
  accepted: boolean;
}

export interface DiscountOfferView extends OfferViewBase {
  kind: 'discount';
  discountPct: number;
  deadlineHours: number;
  originalAmount: number;
  discountedAmount: number;
  savings: number;
  deadlineDate: string;
}

export interface PlanInstallmentView {
  number: number;
  amount: number;
  dueDate: string;
  status?: InstallmentStatus;
  paidAt?: string | null;
}

export interface PlanOfferView extends OfferViewBase {
  kind: 'plan';
  installments: PlanInstallmentView[];
  totalAmount: number;
}

export interface PayLaterOfferView extends OfferViewBase {
  kind: 'pay_later';
  amount: number;
}

export interface RequestOfferView extends OfferViewBase {
  kind: 'request';
  requestedDiscountPct?: number;
  requestedAmount?: number;
  reason: string;
}

export type OfferView =
  | DiscountOfferView
  | PlanOfferView
  | PayLaterOfferView
  | RequestOfferView;
