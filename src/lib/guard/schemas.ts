import { z } from 'zod';

export const DiscountProposalSchema = z.object({
  type: z.literal('discount'),
  discount_pct: z.number().min(0.5, 'Discount must be at least 0.5%').max(100, 'Discount cannot exceed 100%'),
  deadline_hours: z.number().int().min(1, 'Deadline must be at least 1 hour').max(336, 'Deadline cannot exceed 14 days'),
});

export const InstallmentItemSchema = z.object({
  number: z.number().int().positive(),
  amount: z.number().positive('Installment amount must be positive'),
  due_date: z.string().datetime({ message: 'due_date must be a valid ISO 8601 string' }),
});

export const PlanProposalSchema = z.object({
  type: z.literal('plan'),
  installments: z.array(InstallmentItemSchema).min(2, 'Installment plans must have at least 2 installments'),
});

export const PayLaterProposalSchema = z.object({
  type: z.literal('pay_later'),
  invoice_amount: z.number().positive(),
});

export const EscalationSchema = z.object({
  type: z.literal('escalate'),
  reason: z.string().min(1, 'Reason is required for escalation'),
});

export const DisputeSchema = z.object({
  type: z.literal('dispute'),
  reason: z.string().min(1, 'Reason is required for dispute flagging'),
});

export const ProposalSchema = z.discriminatedUnion('type', [
  DiscountProposalSchema,
  PlanProposalSchema,
  PayLaterProposalSchema,
  EscalationSchema,
  DisputeSchema,
]);

export type ProposalInput = z.infer<typeof ProposalSchema>;
export type ValidatedDiscount = z.infer<typeof DiscountProposalSchema>;
export type ValidatedPlan = z.infer<typeof PlanProposalSchema>;
export type ValidatedPayLater = z.infer<typeof PayLaterProposalSchema>;
export type ValidatedEscalation = z.infer<typeof EscalationSchema>;
export type ValidatedDispute = z.infer<typeof DisputeSchema>;

