// ============================================================
// PulsePay — API Request/Response Types
// Shared between frontend and backend
// ============================================================

import type {
  InvoiceRow,
  ClientRow,
  PolicyRow,
  MessageRow,
  ArrangementRow,
  InstallmentRow,
  EventRow,
  InvoiceWithClient,
  ArrangementWithDetails,
} from './database';

// ---------- Dashboard ----------

export interface DashboardKPIs {
  total_outstanding: number;
  total_overdue: number;
  recovered_this_month: number;
  needs_approval: number;
  total_invoices: number;
}

export interface InvoicesResponse {
  invoices: InvoiceWithClient[];
  kpis: DashboardKPIs;
}

// ---------- Policy ----------

export interface PolicyResponse {
  policy: PolicyRow;
}

export interface PolicyUpdateRequest {
  max_discount_pct?: number;
  max_installments?: number;
  min_first_payment_pct?: number;
  approval_threshold?: number;
  max_messages_per_day?: number;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
}

// ---------- Sync ----------

export interface SyncResponse {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

// ---------- Follow-up ----------

export interface FollowUpRequest {
  business_id: string;
}

export interface FollowUpResponse {
  conversation_id: string;
  token: string;
  message: string;
  client_page_url: string;
}

// ---------- Client Page ----------

export interface ClientPageData {
  conversation_id: string;
  invoice: {
    amount: number;
    currency: string;
    due_date: string;
    description: string | null;
    status: string;
  };
  business_name: string;
  messages: MessageRow[];
  offers: ArrangementRow[];
  status: string;
}

export interface ClientMessageRequest {
  content: string;
}

export interface ClientMessageResponse {
  messages: MessageRow[];
  offers?: ArrangementRow[];
  status: string;
  error?: string;
}

export interface ClientAcceptRequest {
  arrangement_id: string;
}

export interface ClientAcceptResponse {
  success: boolean;
  arrangement: ArrangementRow;
  installments?: InstallmentRow[];
  error?: string;
}

// ---------- Approvals ----------

export interface ApprovalsResponse {
  approvals: ArrangementWithDetails[];
}

export interface ApprovalActionRequest {
  action: 'approve' | 'reject' | 'counter';
  counter_terms?: Record<string, unknown>;
  reason?: string;
}

export interface ApprovalActionResponse {
  success: boolean;
  arrangement: ArrangementRow;
  error?: string;
}

// ---------- Demo ----------

export interface DemoClockRequest {
  days: number;
}

export interface DemoClockResponse {
  demo_now: string;
  offset_days: number;
  scheduler_results?: {
    installments_sent: number;
    errors: string[];
  };
}

export interface DemoResetResponse {
  success: boolean;
  message: string;
}

// ---------- Webhook ----------

export interface WebhookResponse {
  received: boolean;
  event_type?: string;
  error?: string;
}

// ---------- Health ----------

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

// ---------- Audit Log ----------

export interface AuditLogResponse {
  events: EventRow[];
  total: number;
}

// ---------- Scheduler ----------

export interface SchedulerResponse {
  processed: number;
  sent: number;
  errors: string[];
}

// ---------- General ----------

export interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

