'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { NegotiationProposal } from '@/types/proposals';
import type { ApprovalsPayload } from '@/lib/approvals/types';
import { isDispute } from '@/lib/approvals/normalize';
import { formatDate, formatMoney } from '@/lib/client-portal/format';
import ApprovalCard from './ApprovalCard';
import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
  RefreshIcon,
  ShieldCheckIcon,
  SpinnerIcon,
} from '@/components/client/icons';

interface ApprovalsQueueProps {
  initial: ApprovalsPayload;
}

interface Feedback {
  tone: 'success' | 'error';
  message: string;
}

export default function ApprovalsQueue({ initial }: ApprovalsQueueProps) {
  const [approvals, setApprovals] = useState(initial.approvals);
  const [policy, setPolicy] = useState(initial.policy);
  const [demoNow, setDemoNow] = useState(initial.demo_now);
  const [refreshing, setRefreshing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const maxDiscount = Number(policy?.max_discount_pct ?? 10);
  const maxInstallments = Number(policy?.max_installments ?? 3);
  const disputeCount = useMemo(
    () => approvals.filter((approval) => isDispute(approval)).length,
    [approvals]
  );
  const totalValue = useMemo(
    () =>
      approvals.reduce((sum, approval) => sum + (Number(approval.invoice?.amount) || 0), 0),
    [approvals]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setQueueError(null);

    try {
      const response = await fetch('/api/approvals', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload === 'object' && payload !== null && typeof payload.error === 'string'
            ? payload.error
            : 'The approvals queue could not be refreshed.'
        );
      }

      setApprovals(payload.approvals || []);
      setPolicy(payload.policy || policy);
      setDemoNow(payload.demo_now || demoNow);
    } catch (error: unknown) {
      setQueueError(
        error instanceof Error
          ? error.message
          : 'The approvals queue could not be refreshed.'
      );
    } finally {
      setRefreshing(false);
    }
  }, [demoNow, policy]);

  const act = useCallback(
    async (id: string, body: Record<string, unknown>, successMessage: string) => {
      setBusyId(id);
      setActionErrors((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });

      try {
        const response = await fetch(`/api/approvals/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            typeof payload === 'object' && payload !== null && typeof payload.error === 'string'
              ? payload.error
              : 'The action could not be completed.'
          );
        }

        setApprovals((current) => current.filter((approval) => approval.id !== id));
        setFeedback({ tone: 'success', message: successMessage });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'The action could not be completed.';
        setActionErrors((current) => ({ ...current, [id]: message }));
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const handleApprove = useCallback(
    (id: string) => {
      void act(id, { action: 'approve' }, 'Approved. The client has been notified.');
    },
    [act]
  );

  const handleReject = useCallback(
    (id: string, reason: string) => {
      void act(
        id,
        { action: 'reject', reason },
        'Request rejected. The client has been notified.'
      );
    },
    [act]
  );

  const handleCounter = useCallback(
    (id: string, terms: NegotiationProposal) => {
      void act(
        id,
        { action: 'counter', counter_terms: terms },
        'Counter-offer sent. The client can now accept it.'
      );
    },
    [act]
  );

  return (
    <div className="ap-root">
      <header className="ap-topbar">
        <div className="ap-brand">
          <span className="ap-mark" aria-hidden>
            PP
          </span>
          <div>
            <p className="ap-brand__name">PulsePay</p>
            <p className="ap-brand__sub">Owner console</p>
          </div>
        </div>

        <div className="ap-topbar__right">
          <span className="ap-demo-time">
            Demo time <strong>{formatDate(demoNow)}</strong>
          </span>
          <button
            type="button"
            className="ap-btn ap-btn--ghost ap-btn--sm"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            {refreshing ? <SpinnerIcon width={15} height={15} /> : <RefreshIcon width={15} height={15} />}
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <main className="ap-main">
        <section className="ap-hero">
          <p className="ap-eyebrow">Human in the loop</p>
          <h1>Approvals &amp; disputes</h1>
          <p className="ap-hero__sub">
            Requests the assistant could not approve on its own. You stay in control of every
            exception.
          </p>
        </section>

        <section className="ap-kpis" aria-label="Queue summary">
          <div className="ap-kpi">
            <span className="ap-kpi__icon">
              <ClockIcon width={17} height={17} />
            </span>
            <div>
              <p className="ap-kpi__label">Waiting</p>
              <p className="ap-kpi__value">{approvals.length}</p>
              <p className="ap-kpi__sub">
                {approvals.length === 1 ? 'request' : 'requests'}
              </p>
            </div>
          </div>

          <div className={`ap-kpi ${disputeCount > 0 ? 'ap-kpi--danger' : ''}`}>
            <span className="ap-kpi__icon">
              <AlertIcon width={17} height={17} />
            </span>
            <div>
              <p className="ap-kpi__label">Disputes</p>
              <p className="ap-kpi__value">{disputeCount}</p>
              <p className="ap-kpi__sub">automation paused</p>
            </div>
          </div>

          <div className="ap-kpi">
            <span className="ap-kpi__icon">
              <ShieldCheckIcon width={17} height={17} />
            </span>
            <div>
              <p className="ap-kpi__label">Value in review</p>
              <p className="ap-kpi__value ap-mono">{formatMoney(totalValue)}</p>
              <p className="ap-kpi__sub">
                across {approvals.length} {approvals.length === 1 ? 'invoice' : 'invoices'}
              </p>
            </div>
          </div>

          <div className="ap-kpi ap-kpi--policy">
            <span className="ap-kpi__icon">
              <CheckCircleIcon width={17} height={17} />
            </span>
            <div>
              <p className="ap-kpi__label">Policy</p>
              <p className="ap-kpi__value">{maxDiscount}%</p>
              <p className="ap-kpi__sub">
                max discount · {maxInstallments} installments
              </p>
            </div>
          </div>
        </section>

        {feedback ? (
          <div className={`ap-feedback ap-feedback--${feedback.tone}`} role="status">
            <CheckCircleIcon width={17} height={17} />
            <p>{feedback.message}</p>
            <button
              type="button"
              className="ap-feedback__close"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        ) : null}

        {queueError ? (
          <div className="ap-feedback ap-feedback--error" role="alert">
            <AlertIcon width={17} height={17} />
            <p>{queueError}</p>
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-btn--sm"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              Try again
            </button>
          </div>
        ) : null}

        <section className="ap-queue" aria-label="Approval queue">
          <div className="ap-queue__head">
            <h2>Queue</h2>
            <span>
              {approvals.length} {approvals.length === 1 ? 'request' : 'requests'} waiting
            </span>
          </div>

          {approvals.length === 0 ? (
            <div className="ap-empty">
              <span className="ap-empty__icon" aria-hidden>
                <ShieldCheckIcon width={24} height={24} />
              </span>
              <h2>Queue clear</h2>
              <p>
                No requests are waiting. When a client asks for something outside your policy, it
                lands here for your sign-off.
              </p>
              <Link className="ap-btn ap-btn--secondary" href="/c/demo-inv2-alex-003">
                Open a client demo
              </Link>
            </div>
          ) : (
            <div className="ap-list">
              {approvals.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  policy={policy}
                  demoNow={demoNow}
                  busy={busyId === approval.id}
                  actionError={actionErrors[approval.id] || null}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onCounter={handleCounter}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="ap-footer">
        <p>PulsePay keeps a human in the loop for every exception.</p>
        <p className="ap-footer__brand">Owner console</p>
      </footer>
    </div>
  );
}
