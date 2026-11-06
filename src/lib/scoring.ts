import type { InvoiceRow, ClientRow } from '@/types/database';

export interface PriorityScoreResult {
  score: number; // 0 to 100 (higher means higher priority / urgency)
  reason: string;
}

/**
 * Calculates priority score and explainable reason for an invoice.
 * Factors:
 * 1. Days overdue (40% weight)
 * 2. Invoice amount tier (35% weight)
 * 3. Client historical reliability / on_time_rate (25% inverse/direct risk weight)
 */
export function calculatePriorityScore(
  invoice: Pick<InvoiceRow, 'amount' | 'due_date' | 'status'>,
  client?: Pick<ClientRow, 'name' | 'on_time_rate' | 'total_invoices'> | null,
  referenceDate: Date = new Date()
): PriorityScoreResult {
  const dueDate = new Date(invoice.due_date);
  const diffMs = referenceDate.getTime() - dueDate.getTime();
  const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (invoice.status === 'PAID') {
    return { score: 0, reason: 'Invoice is already settled' };
  }

  if (daysOverdue <= 0) {
    const daysLeft = Math.abs(daysOverdue);
    return {
      score: 10,
      reason: daysLeft === 0 ? 'Due today' : `Due in ${daysLeft} day(s) (not yet overdue)`,
    };
  }

  // Factor 1: Overdue severity (0 - 40 points)
  // Max out at 60 days
  const overduePoints = Math.min(40, Math.round((daysOverdue / 60) * 40));

  // Factor 2: Amount impact (0 - 35 points)
  // Scaled: < $500 -> 10, < $1500 -> 20, < $3000 -> 28, >= $3000 -> 35
  let amountPoints = 10;
  if (invoice.amount >= 3000) {
    amountPoints = 35;
  } else if (invoice.amount >= 1500) {
    amountPoints = 28;
  } else if (invoice.amount >= 500) {
    amountPoints = 20;
  }

  // Factor 3: Client history risk (0 - 25 points)
  // If client usually pays on time (e.g. 90%), a sudden delay might be accidental (medium priority)
  // If client has poor history (e.g. < 50%), risk of default is high (high priority)
  let historyPoints = 15;
  const onTimeRate = client?.on_time_rate ?? 100;
  if (onTimeRate < 50) {
    historyPoints = 25; // High default risk
  } else if (onTimeRate < 80) {
    historyPoints = 18;
  } else {
    historyPoints = 10; // Frequent payer, likely just forgot
  }

  const totalScore = Math.min(100, Math.max(1, overduePoints + amountPoints + historyPoints));

  // Construct readable explainable reason
  const reasons: string[] = [];
  reasons.push(`${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`);
  reasons.push(`$${Number(invoice.amount).toLocaleString('en-US')} invoice value`);
  if (client) {
    if (client.on_time_rate >= 80) {
      reasons.push(`reliable client (${client.on_time_rate}% on-time rate)`);
    } else {
      reasons.push(`elevated risk profile (${client.on_time_rate}% on-time rate)`);
    }
  }

  return {
    score: totalScore,
    reason: reasons.join(' · '),
  };
}

