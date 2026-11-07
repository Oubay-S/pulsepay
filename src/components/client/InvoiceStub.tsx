import type { ClientPortalInvoice, ClientPortalPayable } from '@/lib/client-portal/types';
import {
  daysPastDue,
  daysUntil,
  formatDate,
  formatMoney,
  initials,
  pluralize,
} from '@/lib/client-portal/format';
import { ArrowUpRightIcon, LockIcon, WalletIcon } from './icons';

interface InvoiceStubProps {
  invoice: ClientPortalInvoice;
  businessName: string;
  clientName: string | null;
  demoNow: string;
  payable: ClientPortalPayable | null;
}

interface Stamp {
  label: string;
  detail: string;
  tone: 'paid' | 'overdue' | 'due' | 'info' | 'muted';
}

function getStamp(invoice: ClientPortalInvoice, demoNow: string): Stamp {
  const late = daysPastDue(invoice.dueDate, demoNow);
  const remaining = daysUntil(invoice.dueDate, demoNow);

  switch (invoice.status) {
    case 'PAID':
      return {
        label: 'Paid',
        detail: 'Settled in full',
        tone: 'paid',
      };
    case 'SUPERSEDED':
      return {
        label: 'In arrangement',
        detail: 'A payment plan is active',
        tone: 'info',
      };
    case 'PARTIALLY_PAID':
      return {
        label: 'Part paid',
        detail: 'A payment arrangement is active',
        tone: 'info',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        detail: 'This invoice was cancelled',
        tone: 'muted',
      };
    case 'DRAFT':
      return {
        label: 'Draft',
        detail: 'Not sent yet',
        tone: 'muted',
      };
    case 'SCHEDULED':
      return {
        label: 'Scheduled',
        detail: `Due ${formatDate(invoice.dueDate, new Date(demoNow))}`,
        tone: 'info',
      };
    default:
      if (late > 0) {
        return {
          label: `${pluralize(late, 'day')} past due`,
          detail: `Was due ${formatDate(invoice.dueDate, new Date(demoNow))}`,
          tone: 'overdue',
        };
      }

      if (remaining <= 7 && remaining >= 0) {
        return {
          label: remaining === 0 ? 'Due today' : `Due in ${pluralize(remaining, 'day')}`,
          detail: `Due ${formatDate(invoice.dueDate, new Date(demoNow))}`,
          tone: 'due',
        };
      }

      return {
        label: 'Due',
        detail: `Due ${formatDate(invoice.dueDate, new Date(demoNow))}`,
        tone: 'info',
      };
  }
}

export default function InvoiceStub({
  invoice,
  businessName,
  clientName,
  demoNow,
  payable,
}: InvoiceStubProps) {
  const stamp = getStamp(invoice, demoNow);
  const now = new Date(demoNow);

  return (
    <aside className="pp-stub" aria-label="Invoice summary">
      <div className="pp-stub__head">
        <span className="pp-mark" aria-hidden>
          {initials(businessName)}
        </span>
        <div className="pp-stub__business">
          <p className="pp-stub__eyebrow">Invoice from</p>
          <p className="pp-stub__business-name">{businessName}</p>
        </div>
      </div>

      <span className={`pp-stamp pp-stamp--${stamp.tone}`}>{stamp.label}</span>

      <div className="pp-stub__amount-block">
        <p className="pp-stub__label">Invoice amount</p>
        <p className="pp-stub__amount">{formatMoney(invoice.amount, invoice.currency)}</p>
        <p className={`pp-stub__status-detail pp-stub__status-detail--${stamp.tone}`}>
          {stamp.detail}
        </p>
      </div>

      {payable ? (
        <div className="pp-stub__pay">
          <a
            className="pp-pay-btn"
            href={payable.payerLink}
            target="_blank"
            rel="noreferrer"
            aria-label={
              payable.kind === 'installment'
                ? `Pay installment ${payable.installmentNumber ?? ''} in PayPal`
                : `Pay ${formatMoney(payable.amount, payable.currency)} in PayPal`
            }
          >
            <WalletIcon width={18} height={18} />
            <span>
              {payable.kind === 'installment'
                ? `Pay installment ${payable.installmentNumber ?? ''}`
                : `Pay ${formatMoney(payable.amount, payable.currency)}`}
            </span>
            <ArrowUpRightIcon width={15} height={15} />
          </a>
          <p className="pp-stub__pay-note">
            Secure checkout on PayPal · {formatMoney(payable.amount, payable.currency)}
          </p>
        </div>
      ) : null}

      {invoice.description ? (
        <p className="pp-stub__memo" title={invoice.description}>
          {invoice.description}
        </p>
      ) : null}

      <dl className="pp-stub__meta">
        <div>
          <dt>Invoice</dt>
          <dd className="pp-mono">{invoice.number}</dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd>{formatDate(invoice.dueDate, now)}</dd>
        </div>
        <div>
          <dt>Billed to</dt>
          <dd>{clientName || 'You'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{stamp.label}</dd>
        </div>
      </dl>

      <div className="pp-stub__tear" aria-hidden />

      <p className="pp-stub__footnote">
        <LockIcon width={14} height={14} />
        Payments are handled securely by PayPal.
      </p>

      <span className="pp-stub__perforation" aria-hidden />
    </aside>
  );
}
