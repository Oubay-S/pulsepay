'use client';

import type { ReactNode } from 'react';
import type { ClientPortalInvoice, OfferView } from '@/lib/client-portal/types';
import { formatDate, formatMoney, pluralize } from '@/lib/client-portal/format';
import InstallmentTimeline from './InstallmentTimeline';
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  PercentIcon,
  SpinnerIcon,
  WalletIcon,
} from './icons';

interface OfferCardProps {
  offer: OfferView;
  invoice: ClientPortalInvoice;
  businessName: string;
  demoNow: string;
  onAccept: (id: string) => void;
  busy: boolean;
  error: string | null;
}

function offerLabel(offer: OfferView): { label: string; icon: ReactNode } {
  switch (offer.kind) {
    case 'discount':
      return { label: 'Early payment', icon: <PercentIcon width={14} height={14} /> };
    case 'plan':
      return { label: 'Payment plan', icon: <CalendarIcon width={14} height={14} /> };
    case 'pay_later':
      return { label: 'PayPal Pay Later', icon: <WalletIcon width={14} height={14} /> };
    default:
      return { label: 'Owner review', icon: <ClockIcon width={14} height={14} /> };
  }
}

function acceptedCopy(offer: OfferView): { title: string; body: string } {
  switch (offer.kind) {
    case 'discount':
      return {
        title: 'Discount active',
        body: 'PayPal has your updated invoice. Pay the discounted amount by the deadline to keep the saving.',
      };
    case 'plan': {
      const total = offer.installments.length;
      const paid = offer.installments.filter((installment) => installment.status === 'PAID').length;

      if (paid >= total) {
        return {
          title: 'Plan complete',
          body: 'Every installment has been paid. Nothing else is needed.',
        };
      }

      if (paid > 0) {
        return {
          title: 'Payment plan active',
          body: `${paid} of ${total} payments settled. The next installment will appear in PayPal on its due date.`,
        };
      }

      return {
        title: 'Payment plan active',
        body: 'The first payment is due now. Later payments are scheduled automatically and will appear in PayPal on their due dates.',
      };
    }
    case 'pay_later':
      return {
        title: 'Pay Later selected',
        body: 'Choose PayPal Pay Later at checkout if it is offered to you.',
      };
    default:
      return {
        title: 'Agreed by the owner',
        body: 'The business owner has reviewed your request. Check the conversation for the final terms.',
      };
  }
}

export default function OfferCard({
  offer,
  invoice,
  businessName,
  demoNow,
  onAccept,
  busy,
  error,
}: OfferCardProps) {
  const meta = offerLabel(offer);
  const statusChip = offer.accepted
    ? { label: 'Active', tone: 'paid' }
    : offer.awaitingApproval
      ? { label: 'With the owner', tone: 'approval' }
      : null;

  return (
    <article
      className={`pp-offer ${offer.canAccept ? 'pp-offer--featured' : ''}`}
      aria-labelledby={`offer-${offer.id}`}
    >
      <div className="pp-offer__topline">
        <span className="pp-offer__kind">
          {meta.icon}
          {meta.label}
        </span>
        {statusChip ? (
          <span className={`pp-chip pp-chip--${statusChip.tone}`}>{statusChip.label}</span>
        ) : null}
      </div>

      {offer.kind === 'plan' ? (
        <PlanOfferBody
          offer={offer}
          demoNow={demoNow}
          businessName={businessName}
          currency={invoice.currency}
        />
      ) : null}

      {offer.kind === 'discount' ? (
        <DiscountOfferBody offer={offer} demoNow={demoNow} currency={invoice.currency} />
      ) : null}

      {offer.kind === 'pay_later' ? (
        <PayLaterOfferBody offer={offer} currency={invoice.currency} />
      ) : null}

      {offer.kind === 'request' ? (
        <RequestOfferBody offer={offer} businessName={businessName} invoice={invoice} />
      ) : null}

      {offer.accepted ? (
        <div className="pp-offer__success">
          <CheckCircleIcon width={20} height={20} />
          <div>
            <p className="pp-offer__success-title">{acceptedCopy(offer).title}</p>
            <p className="pp-offer__success-body">{acceptedCopy(offer).body}</p>
          </div>
        </div>
      ) : null}

      {offer.awaitingApproval ? (
        <div className="pp-offer__pending">
          <ClockIcon width={18} height={18} />
          <p>
            Waiting for {businessName}. This request is outside the assistant&apos;s limits, so the
            owner will review it and reply here.
          </p>
        </div>
      ) : null}

      {offer.canAccept ? (
        <div className="pp-offer__actions">
          <button
            type="button"
            className="pp-btn pp-btn--primary pp-btn--block"
            onClick={() => onAccept(offer.id)}
            disabled={busy}
            aria-busy={busy}
            aria-label={acceptLabel(offer, invoice.currency)}
          >
            {busy ? <SpinnerIcon width={17} height={17} /> : null}
            {busy ? 'Setting up…' : acceptLabel(offer, invoice.currency)}
          </button>
          <p className="pp-offer__micro">
            Nothing is charged now. PayPal will send the payment details.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="pp-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

function acceptLabel(offer: OfferView, currency: string): string {
  if (offer.kind === 'plan') {
    const first = offer.installments[0];
    const equalAmounts = offer.installments.every(
      (item) => Math.abs(item.amount - first.amount) < 0.001
    );

    return equalAmounts
      ? `Accept ${offer.installments.length} × ${formatMoney(first.amount, currency)} plan`
      : 'Accept payment plan';
  }

  if (offer.kind === 'discount') {
    return `Accept ${formatMoney(offer.discountedAmount, currency)} offer`;
  }

  return 'Accept offer';
}

function PlanOfferBody({
  offer,
  demoNow,
  businessName,
  currency,
}: {
  offer: Extract<OfferView, { kind: 'plan' }>;
  demoNow: string;
  businessName: string;
  currency: string;
}) {
  const first = offer.installments[0];
  const equalAmounts = offer.installments.every(
    (item) => Math.abs(item.amount - first.amount) < 0.001
  );
  const paidCount = offer.installments.filter((item) => item.status === 'PAID').length;
  const totalCount = offer.installments.length;
  const progress = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  return (
    <>
      <h3 className="pp-offer__title" id={`offer-${offer.id}`}>
        {equalAmounts
          ? `${pluralize(totalCount, 'payment')} of ${formatMoney(first.amount, currency)}`
          : `Payment plan in ${pluralize(totalCount, 'step')}`}
      </h3>
      <p className="pp-offer__sub">
        Total {formatMoney(offer.totalAmount, currency)} · within {businessName}&apos;s policy
      </p>

      {offer.accepted ? (
        <div className="pp-offer__progress">
          <div className="pp-offer__progress-copy">
            <span>
              {paidCount} of {totalCount} paid
            </span>
            <span>{progress}%</span>
          </div>
          <div
            className="pp-offer__progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Plan progress"
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <InstallmentTimeline installments={offer.installments} currency={currency} demoNow={demoNow} />
    </>
  );
}

function DiscountOfferBody({
  offer,
  demoNow,
  currency,
}: {
  offer: Extract<OfferView, { kind: 'discount' }>;
  demoNow: string;
  currency: string;
}) {
  const expired = Date.parse(offer.deadlineDate) < new Date(demoNow).getTime();

  return (
    <>
      <h3 className="pp-offer__title" id={`offer-${offer.id}`}>
        {offer.savings > 0
          ? `Save ${formatMoney(offer.savings, currency)} — pay ${formatMoney(
              offer.discountedAmount,
              currency
            )}`
          : `Pay ${formatMoney(offer.discountedAmount, currency)}`}
      </h3>
      <p className="pp-offer__sub">
        {offer.discountPct}% off if paid by {formatDate(offer.deadlineDate, new Date(demoNow))}.
      </p>

      <div className="pp-offer__split">
        <div>
          <span>Invoice</span>
          <strong className="pp-mono">{formatMoney(offer.originalAmount, currency)}</strong>
        </div>
        <div>
          <span>With discount</span>
          <strong className="pp-mono">{formatMoney(offer.discountedAmount, currency)}</strong>
        </div>
      </div>

      {expired && !offer.accepted ? (
        <p className="pp-offer__expired">
          This offer expired. You can still reply to the assistant to ask for more time.
        </p>
      ) : null}
    </>
  );
}

function PayLaterOfferBody({
  offer,
  currency,
}: {
  offer: Extract<OfferView, { kind: 'pay_later' }>;
  currency: string;
}) {
  return (
    <>
      <h3 className="pp-offer__title" id={`offer-${offer.id}`}>
        Pay over time with PayPal
      </h3>
      <p className="pp-offer__sub">
        If PayPal offers Pay Later to you at checkout, you can split{' '}
        {formatMoney(offer.amount, currency)} into smaller payments while the business is paid in
        full upfront.
      </p>
      <div className="pp-offer__note">
        <WalletIcon width={16} height={16} />
        <span>Subject to PayPal eligibility. You&apos;ll see the option at PayPal checkout.</span>
      </div>
    </>
  );
}

function RequestOfferBody({
  offer,
  businessName,
  invoice,
}: {
  offer: Extract<OfferView, { kind: 'request' }>;
  businessName: string;
  invoice: ClientPortalInvoice;
}) {
  return (
    <>
      <h3 className="pp-offer__title" id={`offer-${offer.id}`}>
        Custom request with {businessName}
      </h3>
      <p className="pp-offer__sub">
        {offer.requestedDiscountPct !== undefined
          ? `You asked for ${offer.requestedDiscountPct}% off. That is outside what the assistant can approve, so ${businessName} will review it personally.`
          : `This needs a person's review. ${businessName} will look at your request and reply here.`}
      </p>

      {offer.requestedDiscountPct !== undefined ? (
        <div className="pp-offer__split">
          <div>
            <span>Current invoice</span>
            <strong className="pp-mono">{formatMoney(invoice.amount, invoice.currency)}</strong>
          </div>
          <div>
            <span>Requested</span>
            <strong className="pp-mono">
              {offer.requestedAmount !== undefined
                ? formatMoney(offer.requestedAmount, invoice.currency)
                : `${offer.requestedDiscountPct}% off`}
            </strong>
          </div>
        </div>
      ) : null}
    </>
  );
}
