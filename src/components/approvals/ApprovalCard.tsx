'use client';

import { useState } from 'react';
import type { PolicyRow } from '@/types/database';
import type { NegotiationProposal } from '@/types/proposals';
import type { ApprovalArrangement } from '@/lib/approvals/types';
import {
  counterAmount,
  describeRequest,
  explainApproval,
  isDispute,
  isInvoicePayable,
} from '@/lib/approvals/normalize';
import {
  daysPastDue,
  daysUntil,
  formatDate,
  formatMoney,
  initials,
  pluralize,
} from '@/lib/client-portal/format';
import { AlertIcon, CheckIcon, MessageIcon, SpinnerIcon } from '@/components/client/icons';
import CounterForm from './CounterForm';

interface ApprovalCardProps {
  approval: ApprovalArrangement;
  policy: PolicyRow | null;
  demoNow: string;
  busy: boolean;
  actionError: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onCounter: (id: string, terms: NegotiationProposal) => void;
}

export default function ApprovalCard({
  approval,
  policy,
  demoNow,
  busy,
  actionError,
  onApprove,
  onReject,
  onCounter,
}: ApprovalCardProps) {
  const [form, setForm] = useState<'none' | 'reject' | 'counter'>('none');
  const [rejectReason, setRejectReason] = useState('');

  const invoice = approval.invoice;
  const client = invoice.client;
  const request = describeRequest(approval);
  const dispute = isDispute(approval);
  const payable = isInvoicePayable(invoice.status);
  const canApprove = request.executable && payable;
  const late = daysPastDue(invoice.due_date, demoNow);
  const remaining = daysUntil(invoice.due_date, demoNow);
  const token =
    approval.conversation?.token ?? invoice.conversations?.[0]?.token ?? null;
  const reason = explainApproval(approval, policy);

  function toggleForm(next: 'reject' | 'counter') {
    setForm((current) => (current === next ? 'none' : next));
  }

  return (
    <article
      className={`ap-card ${dispute ? 'ap-card--dispute' : ''} ${
        !payable ? 'ap-card--stale' : ''
      }`}
      aria-labelledby={`approval-${approval.id}`}
    >
      {dispute ? (
        <div className="ap-dispute">
          <AlertIcon width={18} height={18} />
          <div>
            <p className="ap-dispute__title">Client dispute — automation paused</p>
            <p className="ap-dispute__body">
              Review the work claim before approving any money terms.
            </p>
          </div>
        </div>
      ) : null}

      <div className="ap-card__head">
        <span className="ap-avatar" aria-hidden>
          {initials(client?.name || 'Client')}
        </span>
        <div className="ap-card__identity">
          <p className="ap-card__client" id={`approval-${approval.id}`}>
            {client?.name || 'Client'}
          </p>
          <p className="ap-card__email">{client?.email || 'No email on file'}</p>
        </div>
        <div className="ap-card__chips">
          <span className={`ap-chip ${dispute ? 'ap-chip--danger' : 'ap-chip--approval'}`}>
            {dispute ? 'Dispute' : request.executable ? 'Pending' : 'Client request'}
          </span>
          {!payable ? (
            <span className="ap-chip ap-chip--muted">
              Invoice {invoice.status.toLowerCase().replace('_', ' ')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="ap-card__body">
        <div className="ap-card__invoice">
          <p className="ap-label">Invoice</p>
          <p className="ap-amount">{formatMoney(invoice.amount, invoice.currency)}</p>
          <p className="ap-meta">
            <span className="ap-mono">{invoice.paypal_invoice_id}</span>
            <span aria-hidden>·</span>
            <span>Due {formatDate(invoice.due_date, new Date(demoNow))}</span>
          </p>
          {late > 0 ? (
            <p className="ap-due">{pluralize(late, 'day')} overdue</p>
          ) : remaining >= 0 ? (
            <p className="ap-due ap-due--ok">
              {remaining === 0 ? 'Due today' : `Due in ${pluralize(remaining, 'day')}`}
            </p>
          ) : null}
        </div>

        <div className="ap-card__request">
          <p className="ap-label">Requested terms</p>
          <RequestSummary approval={approval} demoNow={demoNow} />
        </div>
      </div>

      {!dispute ? (
        <div className="ap-why">
          <AlertIcon width={16} height={16} />
          <p>{reason}</p>
        </div>
      ) : null}

      {actionError ? (
        <p className="ap-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="ap-card__actions">
        {token ? (
          <a
            className="ap-link"
            href={`/c/${token}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageIcon width={15} height={15} />
            Open client page
          </a>
        ) : (
          <span className="ap-link ap-link--muted">No client link</span>
        )}

        <div className="ap-card__buttons">
          {busy ? (
            <span className="ap-working" role="status">
              <SpinnerIcon width={15} height={15} />
              Updating…
            </span>
          ) : null}

          <button
            type="button"
            className="ap-btn ap-btn--ghost"
            onClick={() => toggleForm('reject')}
            disabled={busy || !payable}
            aria-expanded={form === 'reject'}
          >
            Reject
          </button>

          <button
            type="button"
            className={`ap-btn ${
              request.executable ? 'ap-btn--secondary' : 'ap-btn--primary'
            }`}
            onClick={() => toggleForm('counter')}
            disabled={busy || !payable}
            aria-expanded={form === 'counter'}
          >
            Counter
          </button>

          <button
            type="button"
            className={`ap-btn ${
              request.executable ? 'ap-btn--primary' : 'ap-btn--secondary'
            }`}
            onClick={() => onApprove(approval.id)}
            disabled={busy || !canApprove}
            title={
              !request.executable
                ? 'This is a client request, not an executable proposal. Send a counter-offer instead.'
                : !payable
                  ? 'This invoice is no longer payable.'
                  : undefined
            }
          >
            <CheckIcon width={16} height={16} />
            Approve
          </button>
        </div>
      </div>

      {!request.executable && payable ? (
        <p className="ap-card__hint">
          The client asked for custom terms. The assistant cannot execute them directly — send a
          counter-offer to move this forward.
        </p>
      ) : null}

      {!payable ? (
        <p className="ap-card__hint ap-card__hint--warning">
          This invoice is {invoice.status.toLowerCase().replace('_', ' ')}. No action is needed.
        </p>
      ) : null}

      {form === 'reject' ? (
        <form
          className="ap-form"
          onSubmit={(event) => {
            event.preventDefault();
            onReject(approval.id, rejectReason.trim());
          }}
        >
          <label className="ap-field ap-field--full">
            <span>Reason for rejection (optional)</span>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Tell the client what you can offer instead…"
              rows={2}
              disabled={busy}
            />
          </label>
          <div className="ap-form__actions">
            <button
              type="button"
              className="ap-btn ap-btn--ghost"
              onClick={() => setForm('none')}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="ap-btn ap-btn--danger" disabled={busy}>
              {busy ? <SpinnerIcon width={16} height={16} /> : null}
              {busy ? 'Rejecting…' : 'Reject request'}
            </button>
          </div>
        </form>
      ) : null}

      {form === 'counter' ? (
        <CounterForm
          approval={approval}
          policy={policy}
          demoNow={demoNow}
          busy={busy}
          onSubmit={(terms) => onCounter(approval.id, terms)}
          onCancel={() => setForm('none')}
        />
      ) : null}
    </article>
  );
}

function RequestSummary({
  approval,
  demoNow,
}: {
  approval: ApprovalArrangement;
  demoNow: string;
}) {
  const invoice = approval.invoice;
  const request = describeRequest(approval);
  const proposal = request.proposal;

  if (request.kind === 'discount' && proposal?.type === 'discount') {
    const finalAmount = counterAmount(invoice.amount, proposal.discount_pct);

    return (
      <>
        <h3 className="ap-request__title">
          {proposal.discount_pct}% off if paid within {proposal.deadline_hours}h
        </h3>
        <div className="ap-request__split">
          <div>
            <span>Invoice</span>
            <strong className="ap-mono">{formatMoney(invoice.amount, invoice.currency)}</strong>
          </div>
          <div>
            <span>Client pays</span>
            <strong className="ap-mono">{formatMoney(finalAmount, invoice.currency)}</strong>
          </div>
        </div>
      </>
    );
  }

  if (request.kind === 'discount') {
    return (
      <>
        <h3 className="ap-request__title">
          Client asked for {request.requestedDiscountPct}% off
        </h3>
        <div className="ap-request__split">
          <div>
            <span>Invoice</span>
            <strong className="ap-mono">{formatMoney(invoice.amount, invoice.currency)}</strong>
          </div>
          <div>
            <span>Client asked to pay</span>
            <strong className="ap-mono">
              {request.requestedAmount !== undefined
                ? formatMoney(request.requestedAmount, invoice.currency)
                : `${request.requestedDiscountPct}% off`}
            </strong>
          </div>
        </div>
        {request.reason ? <p className="ap-request__reason">{request.reason}</p> : null}
      </>
    );
  }

  if (request.kind === 'plan' && proposal?.type === 'plan') {
    return (
      <>
        <h3 className="ap-request__title">
          {proposal.installments.length}-payment plan
        </h3>
        <ol className="ap-plan">
          {proposal.installments.map((installment) => (
            <li key={installment.number}>
              <span className="ap-plan__number">{installment.number}</span>
              <span className="ap-plan__amount ap-mono">
                {formatMoney(installment.amount, invoice.currency)}
              </span>
              <span className="ap-plan__date">
                {formatDate(installment.due_date, new Date(demoNow))}
              </span>
            </li>
          ))}
        </ol>
      </>
    );
  }

  if (request.kind === 'pay_later' && proposal?.type === 'pay_later') {
    return (
      <>
        <h3 className="ap-request__title">PayPal Pay Later</h3>
        <p className="ap-request__reason">
          Client wants to pay {formatMoney(proposal.invoice_amount, invoice.currency)} over time
          through PayPal, subject to eligibility.
        </p>
      </>
    );
  }

  return (
    <>
      <h3 className="ap-request__title">Custom request</h3>
      <p className="ap-request__reason">
        {request.reason || 'The client asked for terms the assistant could not approve.'}
      </p>
    </>
  );
}
