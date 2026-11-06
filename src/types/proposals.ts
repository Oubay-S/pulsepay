// ============================================================
// PulsePay — Proposal Types
// Used by: Agent → Policy Guard → Executor
// ============================================================

// ---------- Discount ----------

export interface DiscountProposal {
  type: 'discount';
  discount_pct: number; // e.g. 5 = 5% off
  deadline_hours: number; // e.g. 48 = must pay within 48h
}

export interface DiscountTerms {
  original_amount: number;
  discount_pct: number;
  discounted_amount: number;
  deadline: string; // ISO datetime
}

// ---------- Installment Plan ----------

export interface InstallmentDetail {
  number: number;
  amount: number;
  due_date: string; // ISO datetime
}

export interface PlanProposal {
  type: 'plan';
  installments: InstallmentDetail[];
}

export interface PlanTerms {
  original_amount: number;
  num_installments: number;
  installments: InstallmentDetail[];
}

// ---------- Pay Later ----------

export interface PayLaterProposal {
  type: 'pay_later';
  invoice_amount: number;
}

export interface PayLaterTerms {
  invoice_amount: number;
  // PayPal handles the rest — terms depend on client eligibility
}

// ---------- Escalation ----------

export interface EscalationProposal {
  type: 'escalate';
  reason: string;
}

// ---------- Dispute ----------

export interface DisputeProposal {
  type: 'dispute';
  reason: string;
}

// ---------- Union ----------

export type AgentProposal =
  | DiscountProposal
  | PlanProposal
  | PayLaterProposal
  | EscalationProposal
  | DisputeProposal;

export type NegotiationProposal =
  | DiscountProposal
  | PlanProposal
  | PayLaterProposal;

// ---------- Guard Result ----------

export interface GuardAllowed {
  allowed: true;
  proposal: NegotiationProposal;
  needsApproval: false;
}

export interface GuardNeedsApproval {
  allowed: boolean;
  proposal?: NegotiationProposal;
  needsApproval: true;
  reason: string;
}

export interface GuardRejected {
  allowed: false;
  reason: string;
  needsApproval: false;
}

export type GuardResult = GuardAllowed | GuardNeedsApproval | GuardRejected;

// ---------- Execution Result ----------

export interface ExecutionSuccess {
  success: true;
  action: string;
  paypal_ids: string[];
  details: Record<string, unknown>;
}

export interface ExecutionFailure {
  success: false;
  error: string;
  action: string;
}

export type ExecutionResult = ExecutionSuccess | ExecutionFailure;

