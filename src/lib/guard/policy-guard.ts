import { ProposalSchema } from './schemas';
import type { PolicyRow, InvoiceRow } from '@/types/database';
import type {
  AgentProposal,
  NegotiationProposal,
  GuardResult,
} from '@/types/proposals';

/**
 * Validates an agent proposal against strict business owner policy rules.
 * The LLM proposal cannot move money or create agreements without passing this guard.
 */
export async function checkPolicy(
  proposalInput: unknown,
  policy: PolicyRow,
  invoice: InvoiceRow
): Promise<GuardResult> {
  // Step 1: Strict Zod schema validation
  const parseResult = ProposalSchema.safeParse(proposalInput);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return {
      allowed: false,
      needsApproval: false,
      reason: `Proposal schema error: ${errorDetails}`,
    };
  }

  const proposal = parseResult.data as AgentProposal;

  // Step 2: Handle Escalation / Dispute immediately
  if (proposal.type === 'escalate' || proposal.type === 'dispute') {
    return {
      allowed: false,
      needsApproval: true,
      reason: `Client triggered ${proposal.type}: ${proposal.reason}`,
    };
  }

  // Step 3: Check Approval Threshold
  // If invoice amount >= approval_threshold, any arrangement requires owner sign-off
  const isHighValue = invoice.amount >= policy.approval_threshold;

  // Step 4: Validate Specific Negotiation Proposals
  if (proposal.type === 'discount') {
    if (proposal.discount_pct > policy.max_discount_pct) {
      return {
        allowed: false,
        needsApproval: true,
        reason: `Requested discount of ${proposal.discount_pct}% exceeds policy maximum of ${policy.max_discount_pct}%`,
      };
    }

    if (isHighValue) {
      return {
        allowed: true,
        needsApproval: true,
        proposal,
        reason: `Invoice value ($${invoice.amount}) meets or exceeds owner approval threshold ($${policy.approval_threshold})`,
      };
    }

    return {
      allowed: true,
      needsApproval: false,
      proposal,
    };
  }

  if (proposal.type === 'plan') {
    const installments = proposal.installments;

    // Check count of installments
    if (installments.length > policy.max_installments) {
      return {
        allowed: false,
        needsApproval: true,
        reason: `Requested ${installments.length} installments exceeds policy maximum of ${policy.max_installments}`,
      };
    }

    // Check sum of installment amounts equals original invoice amount
    const totalPlanAmount = installments.reduce((acc, curr) => acc + curr.amount, 0);
    const roundedTotal = Math.round(totalPlanAmount * 100) / 100;
    const roundedInvoice = Math.round(invoice.amount * 100) / 100;

    if (Math.abs(roundedTotal - roundedInvoice) > 0.05) {
      return {
        allowed: false,
        needsApproval: false,
        reason: `Total installments sum ($${roundedTotal}) does not match invoice total ($${roundedInvoice})`,
      };
    }

    // Check minimum first payment percentage
    const firstPayment = installments[0]?.amount ?? 0;
    const firstPaymentPct = (firstPayment / invoice.amount) * 100;

    if (firstPaymentPct < policy.min_first_payment_pct - 0.01) {
      return {
        allowed: false,
        needsApproval: true,
        reason: `First installment ($${firstPayment.toFixed(2)}, ${firstPaymentPct.toFixed(1)}%) is below minimum required first payment of ${policy.min_first_payment_pct}%`,
      };
    }

    if (isHighValue) {
      return {
        allowed: true,
        needsApproval: true,
        proposal,
        reason: `Invoice value ($${invoice.amount}) meets or exceeds owner approval threshold ($${policy.approval_threshold})`,
      };
    }

    return {
      allowed: true,
      needsApproval: false,
      proposal,
    };
  }

  if (proposal.type === 'pay_later') {
    // Pay Later passes the entire invoice to PayPal's financing check
    if (Math.abs(proposal.invoice_amount - invoice.amount) > 0.01) {
      return {
        allowed: false,
        needsApproval: false,
        reason: `Pay Later amount ($${proposal.invoice_amount}) does not match invoice amount ($${invoice.amount})`,
      };
    }

    if (isHighValue) {
      return {
        allowed: true,
        needsApproval: true,
        proposal,
        reason: `Invoice value ($${invoice.amount}) meets or exceeds owner approval threshold ($${policy.approval_threshold})`,
      };
    }

    return {
      allowed: true,
      needsApproval: false,
      proposal,
    };
  }

  return {
    allowed: false,
    needsApproval: false,
    reason: 'Unsupported proposal type',
  };
}

