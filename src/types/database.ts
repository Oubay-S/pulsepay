// ============================================================
// PulsePay — Database Row Types
// Mirrors supabase/migrations/001_initial_schema.sql
// ============================================================

// ---------- Enums ----------

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'CANCELLED'
  | 'SUPERSEDED'
  | 'PARTIALLY_PAID'
  | 'SCHEDULED';

export type ConversationStatus =
  | 'ACTIVE'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'DISPUTED';

export type MessageSender = 'AGENT' | 'CLIENT' | 'OWNER' | 'SYSTEM';

export type ArrangementType = 'DISCOUNT' | 'PLAN' | 'PAY_LATER';

export type ArrangementStatus =
  | 'PROPOSED'
  | 'PENDING_APPROVAL'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXECUTED'
  | 'EXPIRED';

export type InstallmentStatus = 'SCHEDULED' | 'SENT' | 'PAID' | 'CANCELLED';

export type EventActor =
  | 'AGENT'
  | 'OWNER'
  | 'CLIENT'
  | 'SCHEDULER'
  | 'PAYPAL'
  | 'SYSTEM';

// ---------- Row Types ----------

export interface BusinessRow {
  id: string;
  name: string;
  paypal_merchant_email: string;
  currency: string;
  tone: string;
  created_at: string;
}

export interface PolicyRow {
  business_id: string;
  max_discount_pct: number;
  max_installments: number;
  min_first_payment_pct: number;
  approval_threshold: number;
  max_messages_per_day: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
  updated_at: string;
}

export interface ClientRow {
  id: string;
  business_id: string;
  name: string;
  email: string;
  on_time_rate: number;
  total_invoices: number;
  total_paid: number;
  created_at: string;
}

export interface InvoiceRow {
  id: string;
  business_id: string;
  client_id: string;
  paypal_invoice_id: string;
  parent_invoice_id: string | null;
  amount: number;
  currency: string;
  due_date: string;
  status: InvoiceStatus;
  priority_score: number;
  priority_reason: string | null;
  description: string | null;
  synced_at: string;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  invoice_id: string;
  token: string;
  status: ConversationStatus;
  messages_today: number;
  last_message_date: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender: MessageSender;
  content: string;
  intent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ArrangementRow {
  id: string;
  invoice_id: string;
  conversation_id: string | null;
  type: ArrangementType;
  terms: Record<string, unknown>;
  status: ArrangementStatus;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstallmentRow {
  id: string;
  arrangement_id: string;
  number: number;
  amount: number;
  due_date: string;
  paypal_invoice_id: string | null;
  status: InstallmentStatus;
  paid_at: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  type: string;
  actor: EventActor;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ProcessedEventRow {
  paypal_event_id: string;
  event_type: string | null;
  created_at: string;
}

export interface DemoClockRow {
  id: number;
  offset_days: number;
  updated_at: string;
}

// ---------- Insert Types (omit auto-generated fields) ----------

export type BusinessInsert = Omit<BusinessRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type PolicyInsert = Omit<PolicyRow, 'updated_at'> & {
  updated_at?: string;
};

export type ClientInsert = Omit<ClientRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type InvoiceInsert = Omit<InvoiceRow, 'id' | 'synced_at' | 'created_at'> & {
  id?: string;
  synced_at?: string;
  created_at?: string;
};

export type ConversationInsert = Omit<ConversationRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type MessageInsert = Omit<MessageRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ArrangementInsert = Omit<ArrangementRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type InstallmentInsert = Omit<InstallmentRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type EventInsert = Omit<EventRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

// ---------- Update Types ----------

export type PolicyUpdate = Partial<Omit<PolicyRow, 'business_id'>>;
export type InvoiceUpdate = Partial<Omit<InvoiceRow, 'id'>>;
export type ConversationUpdate = Partial<Omit<ConversationRow, 'id'>>;
export type ArrangementUpdate = Partial<Omit<ArrangementRow, 'id'>>;
export type InstallmentUpdate = Partial<Omit<InstallmentRow, 'id'>>;

// ---------- Joined Types (for API responses) ----------

export interface InvoiceWithClient extends InvoiceRow {
  client: ClientRow;
  conversations?: Array<{ token: string; status: ConversationStatus }> | null;
}

export interface ConversationWithMessages extends ConversationRow {
  messages: MessageRow[];
  invoice: InvoiceRow;
  client: ClientRow;
}

export interface ArrangementWithDetails extends ArrangementRow {
  invoice: InvoiceRow;
  client: ClientRow;
  installments?: InstallmentRow[];
}

