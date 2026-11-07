import type {
  ArrangementRow,
  ClientRow,
  ConversationStatus,
  InvoiceRow,
  PolicyRow,
} from '@/types/database';

export interface ApprovalConversation {
  status: ConversationStatus;
  token: string;
}

export interface ApprovalArrangement extends ArrangementRow {
  invoice: InvoiceRow & {
    client: ClientRow | null;
    conversations?: Array<{ token: string; status: ConversationStatus }> | null;
  };
  conversation: ApprovalConversation | null;
}

export interface ApprovalsPayload {
  approvals: ApprovalArrangement[];
  policy: PolicyRow | null;
  demo_now: string;
}
