import type { InvoiceRow, ClientRow, InvoiceStatus } from '@/types/database';

export interface PriorityScoreResult {
  score: number; // 0 to 100 (higher means higher priority / urgency)
  reason: string;
}

/**
 * Calculates a deterministic priority score and explainable AI reason for an invoice.
 * Weight Distribution:
 * 1. Days overdue (40% weight - max 40 pts reached at 60 days)
 * 2. Amount tier (35% weight - scaled by financial exposure)
 * 3. Client historical risk (25% weight - inverse of on-time payment rate)
 */
export function calculatePriorityScore(
  invoice: Pick<InvoiceRow, 'amount' | 'due_date' | 'status'>,
  client?: Pick<ClientRow, 'name' | 'on_time_rate' | 'total_invoices'> | null,
  referenceDate: Date = new Date()
): PriorityScoreResult {
  // Terminal or non-actionable invoice statuses
  if (invoice.status === 'PAID') {
    return { score: 0, reason: 'Invoice is settled in full' };
  }

  if (invoice.status === 'CANCELLED' || invoice.status === 'SUPERSEDED') {
    return { score: 0, reason: `Invoice is ${invoice.status.toLowerCase()} (non-actionable)` };
  }

  const dueDate = new Date(invoice.due_date);
  const diffMs = referenceDate.getTime() - dueDate.getTime();
  const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Current invoices (not yet overdue)
  if (daysOverdue <= 0) {
    const daysLeft = Math.abs(daysOverdue);
    return {
      score: 10,
      reason: daysLeft === 0 ? 'Payment due today' : `Due in ${daysLeft} day(s) (current)`,
    };
  }

  // Factor 1: Overdue severity (0 to 40 points, maxes out at 60 days late)
  const overduePoints = Math.min(40, Math.round((daysOverdue / 60) * 40));

  // Factor 2: Financial exposure / amount impact (0 to 35 points)
  let amountPoints = 10;
  if (invoice.amount >= 3000) {
    amountPoints = 35; // Major commercial exposure
  } else if (invoice.amount >= 1500) {
    amountPoints = 28; // Substantial contract balance
  } else if (invoice.amount >= 500) {
    amountPoints = 20; // Standard milestone balance
  }

  // Factor 3: Client history risk (0 to 25 points)
  // High on-time rate (>80%) = accidental oversight -> lower risk
  // Low on-time rate (<50%) = pattern of delinquency -> critical risk
  let historyPoints = 15;
  const onTimeRate = client?.on_time_rate ?? 100;
  if (onTimeRate < 50) {
    historyPoints = 25; // High default / delinquency risk
  } else if (onTimeRate < 80) {
    historyPoints = 18; // Inconsistent payment history
  } else {
    historyPoints = 10; // Proven payer, likely administrative delay
  }

  const totalScore = Math.min(100, Math.max(1, overduePoints + amountPoints + historyPoints));

  // Construct clear, explainable rationale for the AG Grid tooltip
  const reasons: string[] = [];
  reasons.push(`${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`);
  reasons.push(`$${Number(invoice.amount).toLocaleString('en-US')} exposure`);

  if (client) {
    if (client.on_time_rate >= 80) {
      reasons.push(`reliable client (${client.on_time_rate}% on-time)`);
    } else if (client.on_time_rate < 50) {
      reasons.push(`high-risk history (${client.on_time_rate}% on-time)`);
    } else {
      reasons.push(`moderate risk profile (${client.on_time_rate}% on-time)`);
    }
  }

  return {
    score: totalScore,
    reason: reasons.join(' · '),
  };
}
