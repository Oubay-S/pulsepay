'use client';

import { useMemo, useState } from 'react';
import type { PolicyRow } from '@/types/database';
import type { NegotiationProposal } from '@/types/proposals';
import type { ApprovalArrangement } from '@/lib/approvals/types';
import {
  buildPlanCounter,
  counterAmount,
  defaultCounterDiscount,
} from '@/lib/approvals/normalize';
import { formatDate, formatMoney } from '@/lib/client-portal/format';
import { CheckIcon, SpinnerIcon } from '@/components/client/icons';

interface CounterFormProps {
  approval: ApprovalArrangement;
  policy: PolicyRow | null;
  demoNow: string;
  busy: boolean;
  onSubmit: (terms: NegotiationProposal) => void;
  onCancel: () => void;
}

type CounterKind = 'discount' | 'plan';

export default function CounterForm({
  approval,
  policy,
  demoNow,
  busy,
  onSubmit,
  onCancel,
}: CounterFormProps) {
  const invoice = approval.invoice;
  const maxDiscount = Number(policy?.max_discount_pct ?? 10);
  const maxInstallments = Number(policy?.max_installments ?? 3);
  const minFirstPct = Number(policy?.min_first_payment_pct ?? 30);

  const [kind, setKind] = useState<CounterKind>('discount');
  const [discountPct, setDiscountPct] = useState(() =>
    defaultCounterDiscount(approval, maxDiscount)
  );
  const [deadlineHours, setDeadlineHours] = useState(48);
  const [installmentCount, setInstallmentCount] = useState(maxInstallments);
  const [firstAmount, setFirstAmount] = useState(() => {
    const equal = Math.round((invoice.amount / Math.max(2, maxInstallments)) * 100) / 100;
    const minimum = Math.round(invoice.amount * (minFirstPct / 100) * 100) / 100;
    return Math.max(equal, minimum);
  });

  const discountPreview = counterAmount(invoice.amount, discountPct);
  const discountValid =
    Number.isFinite(discountPct) &&
    discountPct >= 0.5 &&
    discountPct <= maxDiscount &&
    Number.isFinite(deadlineHours) &&
    deadlineHours >= 1 &&
    deadlineHours <= 336;

  const planPreview = useMemo(() => {
    if (!Number.isFinite(installmentCount) || installmentCount < 2) return null;
    if (!Number.isFinite(firstAmount) || firstAmount <= 0 || firstAmount >= invoice.amount) {
      return null;
    }

    return buildPlanCounter({
      invoiceAmount: invoice.amount,
      installments: installmentCount,
      firstAmount,
      firstDueDate: demoNow,
    });
  }, [demoNow, firstAmount, installmentCount, invoice.amount]);

  const planValid =
    planPreview !== null &&
    installmentCount <= maxInstallments &&
    Number.isFinite(firstAmount) &&
    firstAmount <= invoice.amount - (Math.max(2, installmentCount) - 1) * 0.01;
  const deadlineDate = new Date(
    new Date(demoNow).getTime() + Math.max(1, deadlineHours) * 3_600_000
  ).toISOString();

  function submit() {
    if (busy) return;

    if (kind === 'discount' && discountValid) {
      onSubmit({
        type: 'discount',
        discount_pct: Math.round(discountPct * 10) / 10,
        deadline_hours: Math.round(deadlineHours),
      });
      return;
    }

    if (kind === 'plan' && planPreview && planValid) {
      onSubmit(planPreview);
    }
  }

  return (
    <div className="ap-form ap-counter">
      <div className="ap-tabs" role="tablist" aria-label="Counter-offer type">
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'discount'}
          className={kind === 'discount' ? 'is-active' : ''}
          onClick={() => setKind('discount')}
        >
          Discount
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'plan'}
          className={kind === 'plan' ? 'is-active' : ''}
          onClick={() => setKind('plan')}
        >
          Payment plan
        </button>
      </div>

      {kind === 'discount' ? (
        <>
          <div className="ap-form__grid">
            <label className="ap-field">
              <span>Discount</span>
              <div className="ap-input-wrap">
                <input
                  type="number"
                  min={0.5}
                  max={maxDiscount}
                  step={0.5}
                  value={discountPct}
                  onChange={(event) => setDiscountPct(Number(event.target.value))}
                  disabled={busy}
                />
                <span className="ap-input-suffix">%</span>
              </div>
            </label>

            <label className="ap-field">
              <span>Pay within</span>
              <div className="ap-input-wrap">
                <input
                  type="number"
                  min={1}
                  max={336}
                  step={1}
                  value={deadlineHours}
                  onChange={(event) => setDeadlineHours(Number(event.target.value))}
                  disabled={busy}
                />
                <span className="ap-input-suffix">hours</span>
              </div>
            </label>
          </div>

          <div className="ap-preview">
            <div>
              <span>Client pays</span>
              <strong className="ap-mono">
                {formatMoney(discountPreview, invoice.currency)}
              </strong>
            </div>
            <div>
              <span>Saving</span>
              <strong className="ap-mono ap-saving">
                {formatMoney(Math.max(0, invoice.amount - discountPreview), invoice.currency)}
              </strong>
            </div>
            <div>
              <span>Deadline</span>
              <strong>{formatDate(deadlineDate, new Date(demoNow))}</strong>
            </div>
          </div>

          {!discountValid ? (
            <p className="ap-form__error" role="alert">
              Discount must be between 0.5% and {maxDiscount}%, with a deadline of 1–336 hours.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="ap-form__grid">
            <label className="ap-field">
              <span>Installments</span>
              <div className="ap-input-wrap">
                <input
                  type="number"
                  min={2}
                  max={maxInstallments}
                  step={1}
                  value={installmentCount}
                  onChange={(event) => setInstallmentCount(Number(event.target.value))}
                  disabled={busy}
                />
                <span className="ap-input-suffix">payments</span>
              </div>
            </label>

            <label className="ap-field">
              <span>First payment</span>
              <div className="ap-input-wrap">
                <span className="ap-input-prefix">$</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={firstAmount}
                  onChange={(event) => setFirstAmount(Number(event.target.value))}
                  disabled={busy}
                />
              </div>
            </label>
          </div>

          {planPreview && planPreview.type === 'plan' ? (
            <>
              <div className="ap-plan-preview">
                {planPreview.installments.map((installment) => (
                  <div key={installment.number} className="ap-plan-preview__row">
                    <span className="ap-plan-preview__number">{installment.number}</span>
                    <span className="ap-plan-preview__amount ap-mono">
                      {formatMoney(installment.amount, invoice.currency)}
                    </span>
                    <span className="ap-plan-preview__date">
                      {installment.number === 1
                        ? 'Due now'
                        : formatDate(installment.due_date, new Date(demoNow))}
                    </span>
                  </div>
                ))}
              </div>
              {!planValid ? (
                <p className="ap-form__error" role="alert">
                  Keep at most {maxInstallments} installments and leave at least $0.01 for each
                  remaining payment.
                </p>
              ) : null}
            </>
          ) : (
            <p className="ap-form__error" role="alert">
              Enter a first payment above $0 and below the invoice total.
            </p>
          )}

          <p className="ap-form__hint">
            Policy: up to {maxInstallments} installments and a first payment of at least{' '}
            {minFirstPct}% ({formatMoney((invoice.amount * minFirstPct) / 100, invoice.currency)}).
          </p>
        </>
      )}

      <div className="ap-form__actions">
        <button type="button" className="ap-btn ap-btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="ap-btn ap-btn--primary"
          onClick={submit}
          disabled={busy || (kind === 'discount' ? !discountValid : !planValid)}
        >
          {busy ? <SpinnerIcon width={16} height={16} /> : <CheckIcon width={16} height={16} />}
          {busy ? 'Sending…' : 'Send counter-offer'}
        </button>
      </div>
    </div>
  );
}
