import type { PolicyRow } from '@/types/database';

// Why an agent-initiated follow-up must not be sent right now, or null if it may.
// Applies to follow-ups only: replying to a client who just wrote is never blocked.
export function followUpBlockReason({
  policy,
  now,
  sentLast24h,
  timeZone,
}: {
  policy: Pick<PolicyRow, 'max_messages_per_day' | 'quiet_hours_start' | 'quiet_hours_end'>;
  now: Date;
  sentLast24h: number;
  timeZone: string;
}): string | null {
  if (sentLast24h >= policy.max_messages_per_day) {
    return `Daily limit reached: ${sentLast24h} of ${policy.max_messages_per_day} follow-ups already sent in the last 24 hours.`;
  }

  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now));
  const { quiet_hours_start: start, quiet_hours_end: end } = policy;
  // A window like 22 -> 8 wraps past midnight; start === end means no quiet hours.
  const quiet = start < end ? hour >= start && hour < end : start > end && (hour >= start || hour < end);
  if (quiet) {
    return `Quiet hours (${start}:00-${end}:00 ${timeZone}): no follow-ups are sent now.`;
  }

  return null;
}
