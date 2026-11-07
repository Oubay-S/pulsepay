import type { ClientPortalInvoice, ClientPortalPayable } from '@/lib/client-portal/types';
import {
  daysPastDue,
  daysUntil,
  formatDate,
  formatMoney,
  initials,
  pluralize,
} from '@/lib/client-portal/format';
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  InfoIcon,
  LockIcon,
  WalletIcon,
} from './icons';

interface InvoiceStubProps {
  invoice: ClientPortalInvoice;
  businessName: string;
  clientName: string | null;
  demoNow: string;
  payable: ClientPortalPayable | null;
}

type StatusTone = 'paid' | 'overdue' | 'due' | 'info' | 'muted';

interface StatusView {
  label: string;
  detail: string;
  tone: StatusTone;
}

function getStatus(invoice: ClientPortalInvoice, demoNow: string): StatusView {
  const late = daysPastDue(invoice.dueDate, demoNow);
  const remaining = daysUntil(invoice.dueDate, demoNow);

  switch (invoice.status) {
    case 'PAID':
      return { label: 'Paid', detail: 'Settled in full', tone: 'paid' };
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
      return { label: 'Cancelled', detail: 'This invoice was cancelled', tone: 'muted' };
    case 'DRAFT':
      return { label: 'Draft', detail: 'Not sent yet', tone: 'muted' };
    case 'SCHEDULED':
      return {
        label: 'Scheduled',
        detail: `Due ${formatDate(invoice.dueDate, new Date(demoNow))}`,
        tone: 'info',
      };
    default:
      if (late > 0) {
        return {
          label: pluralize(late, 'day') + ' overdue',
          detail: `Due ${formatDate(invoice.dueDate, new Date(demoNow))}`,
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

function stageFor(invoice: ClientPortalInvoice): number {
  if (invoice.status === 'PAID') return 2;
  if (invoice.status === 'SUPERSEDED' || invoice.status === 'PARTIALLY_PAID') return 1;
  return 0;
}

export default function InvoiceStub({
  invoice,
  businessName,
  clientName,
  demoNow,
  payable,
}: InvoiceStubProps) {
  const status = getStatus(invoice, demoNow);
  const now = new Date(demoNow);
  const stage = stageFor(invoice);
  const payLabel = payable
    ? `Pay ${formatMoney(payable.amount, payable.currency)} with PayPal`
    : null;
  const amountLabel =
    invoice.status === 'PAID'
      ? 'Amount paid'
      : invoice.status === 'SUPERSEDED' || invoice.status === 'PARTIALLY_PAID'
        ? 'Invoice amount'
        : invoice.status === 'CANCELLED' || invoice.status === 'DRAFT'
          ? 'Invoice amount'
          : 'Amount due';

  return (
    <aside className="pp-stub" aria-label="Invoice summary">
      <div className="pp-stub__top">
        <div className="pp-stub__business">
          <span className="pp-stub__mark" aria-hidden>
            {initials(businessName)}
          </span>
          <div>
            <p className="pp-stub__business-name">{businessName}</p>
            <p className="pp-stub__business-sub">Invoice</p>
          </div>
        </div>

        <span className={`pp-status pp-status--${status.tone}`}>
          <span className="pp-status__dot" aria-hidden />
          {status.label}
        </span>
      </div>

      <div className="pp-stub__amount-block">
        <p className="pp-stub__label">{amountLabel}</p>
        <p className="pp-stub__amount">{formatMoney(invoice.amount, invoice.currency)}</p>
        <p className="pp-stub__status-detail">{status.detail}</p>
      </div>

      {payable && payLabel ? (
        <div className="pp-stub__pay">
          <a
            className="pp-pay-btn"
            href={payable.payerLink}
            target="_blank"
            rel="noreferrer"
            aria-label={payLabel}
          >
            <WalletIcon width={18} height={18} />
            <span>{payLabel}</span>
            <ArrowUpRightIcon width={15} height={15} />
          </a>
          <p className="pp-stub__pay-note">
            {payable.kind === 'installment'
              ? `Installment ${payable.installmentNumber ?? ''} · `
              : ''}
            You&apos;ll be redirected to PayPal to complete payment.
          </p>
        </div>
      ) : invoice.status === 'PAID' ? (
        <div className="pp-stub__paid-note">
          <CheckCircleIcon width={17} height={17} />
          Paid in full — thank you.
        </div>
      ) : (
        <div className="pp-stub__paid-note pp-stub__paid-note--muted">
          <InfoIcon width={16} height={16} />
          No payment is due right now.
        </div>
      )}

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
          <dt>Currency</dt>
          <dd>{invoice.currency}</dd>
        </div>
      </dl>

      <div className="pp-rail" aria-label="Payment journey">
        {['Invoice', 'Agreement', 'Paid'].map((label, index) => (
          <div
            key={label}
            className={`pp-rail__step ${index < stage ? 'is-done' : ''} ${
              index === stage ? 'is-current' : ''
            }`}
          >
            <span className="pp-rail__dot" aria-hidden />
            <span className="pp-rail__label">{label}</span>
          </div>
        ))}
      </div>

      <p className="pp-stub__footnote">
        <LockIcon width={13} height={13} />
        Payments are protected by PayPal.
      </p>
    </aside>
  );
}
