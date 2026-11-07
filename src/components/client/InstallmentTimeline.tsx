import type { PlanInstallmentView } from '@/lib/client-portal/types';
import { formatDate, formatMoney } from '@/lib/client-portal/format';
import { CheckIcon } from './icons';

interface InstallmentTimelineProps {
  installments: PlanInstallmentView[];
  currency: string;
  demoNow: string;
}

function statusLabel(status: PlanInstallmentView['status']): string {
  switch (status) {
    case 'PAID':
      return 'Paid';
    case 'SENT':
      return 'Due now';
    case 'CANCELLED':
      return 'Cancelled';
    case 'SCHEDULED':
      return 'Scheduled';
    default:
      return 'Planned';
  }
}

export default function InstallmentTimeline({
  installments,
  currency,
  demoNow,
}: InstallmentTimelineProps) {
  const now = new Date(demoNow);

  return (
    <ol className="pp-timeline" aria-label="Payment schedule">
      {installments.map((installment) => {
        const paid = installment.status === 'PAID';
        const status = statusLabel(installment.status);
        const tone = paid ? 'paid' : installment.status === 'SENT' ? 'sent' : 'scheduled';

        return (
          <li key={installment.number} className={`pp-timeline__item pp-timeline__item--${tone}`}>
            <span className="pp-timeline__marker" aria-hidden>
              {paid ? <CheckIcon width={13} height={13} /> : installment.number}
            </span>
            <div className="pp-timeline__copy">
              <p className="pp-timeline__title">
                Payment {installment.number}
                <span className="pp-timeline__amount">
                  {formatMoney(installment.amount, currency)}
                </span>
              </p>
              <p className="pp-timeline__date">
                {paid && installment.paidAt
                  ? `Paid ${formatDate(installment.paidAt, now)}`
                  : `Due ${formatDate(installment.dueDate, now)}`}
              </p>
            </div>
            <span className={`pp-chip pp-chip--${tone}`}>{status}</span>
          </li>
        );
      })}
    </ol>
  );
}
