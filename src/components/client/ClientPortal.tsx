'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MessageRow } from '@/types/database';
import {
  normalizeClientPortalData,
  normalizeOffers,
} from '@/lib/client-portal/normalize';
import type {
  ClientPortalData,
  ClientPortalLoadFailure,
} from '@/lib/client-portal/types';
import { initials } from '@/lib/client-portal/format';
import ConversationThread from './ConversationThread';
import InvoiceStub from './InvoiceStub';
import MessageComposer from './MessageComposer';
import OfferPanel from './OfferPanel';
import PortalError from './PortalError';
import PortalSkeleton from './PortalSkeleton';
import StatusBanner from './StatusBanner';
import { LockIcon, MessageIcon, SparklesIcon } from './icons';

interface ClientPortalProps {
  token: string;
  initialData: ClientPortalData | null;
  initialFailure: ClientPortalLoadFailure | null;
}

class PortalLoadError extends Error {
  kind: ClientPortalLoadFailure['kind'];

  constructor(kind: ClientPortalLoadFailure['kind'], message: string) {
    super(message);
    this.kind = kind;
  }
}

export default function ClientPortal({
  token,
  initialData,
  initialFailure,
}: ClientPortalProps) {
  const [data, setData] = useState<ClientPortalData | null>(initialData);
  const [loading, setLoading] = useState(!initialData && !initialFailure);
  const [loadFailure, setLoadFailure] = useState<ClientPortalLoadFailure | null>(
    initialFailure
  );
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<{ offerId: string; message: string } | null>(null);
  const [showJump, setShowJump] = useState(false);

  const dataRef = useRef<ClientPortalData | null>(initialData);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const commitData = useCallback((next: ClientPortalData | null) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      try {
        const response = await fetch(`/api/c/${encodeURIComponent(token)}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });

        const payload: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : 'The invoice could not be loaded.';

          throw new PortalLoadError(
            response.status === 404 ? 'not_found' : 'error',
            message
          );
        }

        if (!mountedRef.current) return;

        const next = normalizeClientPortalData(payload);
        commitData(next);
        setLoadFailure(null);
        setConnectionIssue(false);
      } catch (error: unknown) {
        if (!mountedRef.current) return;

        const failure: ClientPortalLoadFailure =
          error instanceof PortalLoadError
            ? { kind: error.kind, message: error.message }
            : {
                kind: 'error',
                message:
                  'We could not reach the server. Check your connection and try again.',
              };

        if (options.silent && dataRef.current) {
          setConnectionIssue(true);
          return;
        }

        setLoadFailure(failure);
      } finally {
        if (mountedRef.current && !options.silent) setLoading(false);
      }
    },
    [commitData, token]
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hasData = Boolean(data);

  useEffect(() => {
    if (!hasData) return;

    const refresh = () => {
      if (document.visibilityState === 'visible' && !busyRef.current) {
        void load({ silent: true });
      }
    };

    const interval = window.setInterval(refresh, 6000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [hasData, load]);

  const businessName = data?.businessName;
  const invoiceNumber = data?.invoice.number;

  useEffect(() => {
    if (!businessName || !invoiceNumber) return;
    document.title = `${businessName} · Invoice ${invoiceNumber}`;
  }, [businessName, invoiceNumber]);

  const offers = useMemo(() => {
    if (!data) return [];

    const normalized = normalizeOffers(data.offers, data.invoice);
    if (data.status === 'ACTIVE') return normalized;

    // A paused conversation must never expose an accept button.
    return normalized.map((offer) => ({ ...offer, canAccept: false }));
  }, [data]);

  const messageCount = data?.messages.length ?? 0;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const element = threadRef.current;
    if (!element) return;

    element.scrollTo({ top: element.scrollHeight, behavior });
    stickToBottomRef.current = true;
    setShowJump(false);
  }, []);

  useEffect(() => {
    if (!hasData) return;

    const frame = window.requestAnimationFrame(() => {
      if (stickToBottomRef.current) {
        const behavior: ScrollBehavior = messageCount <= 1 ? 'auto' : 'smooth';
        scrollToBottom(behavior);
      } else if (messageCount > 0) {
        setShowJump(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hasData, messageCount, scrollToBottom]);

  const handleThreadScroll = useCallback(() => {
    const element = threadRef.current;
    if (!element) return;

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    const nearBottom = distanceFromBottom < 120;

    stickToBottomRef.current = nearBottom;
    if (nearBottom) setShowJump(false);
  }, []);

  const rollbackOptimisticMessage = useCallback(
    (tempId: string) => {
      const current = dataRef.current;
      if (!current) return;

      commitData({
        ...current,
        messages: current.messages.filter((message) => message.id !== tempId),
      });
    },
    [commitData]
  );

  const handleSend = useCallback(
    async (content: string): Promise<{ ok: boolean; error?: string }> => {
      const current = dataRef.current;
      if (!current || sending || busyRef.current) {
        return { ok: false, error: 'The message could not be sent.' };
      }

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: MessageRow = {
        id: tempId,
        conversation_id: current.conversationId,
        sender: 'CLIENT',
        content,
        intent: null,
        metadata: null,
        created_at: new Date().toISOString(),
      };

      commitData({
        ...current,
        messages: [...current.messages, optimisticMessage],
      });

      setSendError(null);
      busyRef.current = true;
      setSending(true);

      try {
        const response = await fetch(`/api/c/${encodeURIComponent(token)}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });

        const payload: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          rollbackOptimisticMessage(tempId);

          const message =
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : 'Your message could not be sent. Please try again.';

          setSendError(message);

          // The conversation may have been paused by the owner while the
          // client was typing. Refresh so the composer locks immediately.
          if (response.status === 409) {
            void load({ silent: true });
          }

          return { ok: false, error: message };
        }

        await load({ silent: true });
        return { ok: true };
      } catch {
        rollbackOptimisticMessage(tempId);
        const message =
          'We could not reach the server. Check your connection and try again.';
        setSendError(message);
        return { ok: false, error: message };
      } finally {
        busyRef.current = false;
        setSending(false);
      }
    },
    [load, rollbackOptimisticMessage, sending, token, commitData]
  );

  const handleAccept = useCallback(
    async (offerId: string) => {
      if (acceptingId || busyRef.current) return;

      setAcceptError(null);
      setAcceptingId(offerId);
      busyRef.current = true;

      try {
        const response = await fetch(`/api/c/${encodeURIComponent(token)}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ arrangement_id: offerId }),
        });

        const payload: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : 'The option could not be set up. Please try again.';

          setAcceptError({ offerId, message });

          if (response.status === 409) {
            void load({ silent: true });
          }

          return;
        }

        await load({ silent: true });
      } catch {
        setAcceptError({
          offerId,
          message: 'We could not reach the server. Check your connection and try again.',
        });
      } finally {
        busyRef.current = false;
        setAcceptingId(null);
      }
    },
    [acceptingId, load, token]
  );

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setLoading(true);
    await load();
    setRetrying(false);
  }, [load]);

  if (loading && !data) {
    return <PortalSkeleton />;
  }

  if (loadFailure && !data) {
    return (
      <PortalError
        kind={loadFailure.kind}
        message={loadFailure.message}
        onRetry={() => void handleRetry()}
        retrying={retrying}
      />
    );
  }

  if (!data) {
    return (
      <PortalError
        kind="error"
        message="The invoice could not be loaded."
        onRetry={() => void handleRetry()}
        retrying={retrying}
      />
    );
  }

  const invoicePaid = data.invoice.status === 'PAID';
  const conversationPaused = data.status !== 'ACTIVE';
  const canMessage = !invoicePaid && !conversationPaused;
  const pendingApproval = offers.some((offer) => offer.awaitingApproval);
  const hasClientMessage = data.messages.some((message) => message.sender === 'CLIENT');
  const showQuickReplies =
    !hasClientMessage &&
    !conversationPaused &&
    !invoicePaid &&
    (data.invoice.status === 'SENT' || data.invoice.status === 'PARTIALLY_PAID');

  const disabledReason = invoicePaid
    ? 'This invoice is paid in full. The conversation is closed.'
    : data.status === 'DISPUTED'
      ? 'Automation is paused while the business owner reviews your message.'
      : data.status === 'ESCALATED'
        ? 'The business owner is reviewing this conversation.'
        : data.status === 'RESOLVED'
          ? 'This conversation is closed.'
          : undefined;

  const primaryBanner = invoicePaid ? (
    <StatusBanner tone="success" title="Paid in full — thank you">
      This invoice is settled. No balance remains.
    </StatusBanner>
  ) : data.status === 'DISPUTED' ? (
    <StatusBanner tone="warning" title="Automation paused — the owner has been notified">
      Your note went straight to {data.businessName}. They will reply here personally. No further
      automated follow-ups will be sent.
    </StatusBanner>
  ) : data.status === 'ESCALATED' ? (
    <StatusBanner tone="info" title="A person is reviewing this conversation">
      {data.businessName} will reply here as soon as they can.
    </StatusBanner>
  ) : pendingApproval ? (
    <StatusBanner tone="warning" title="Your request is with the business owner">
      You asked for something outside the assistant&apos;s limits. {data.businessName} will review
      it and reply here.
    </StatusBanner>
  ) : null;

  return (
    <main className="pp-shell">
      <header className="pp-topbar">
        <div className="pp-brand">
          <span className="pp-mark" aria-hidden>
            {initials(data.businessName)}
          </span>
          <div className="pp-brand__copy">
            <p className="pp-brand__name">{data.businessName}</p>
            <p className="pp-brand__sub">Billing assistant</p>
          </div>
        </div>

        <span className="pp-secure">
          <LockIcon width={14} height={14} />
          Private link
        </span>
      </header>

      <div className="pp-layout">
        <div className="pp-side">
          <InvoiceStub
            invoice={data.invoice}
            businessName={data.businessName}
            clientName={data.clientName}
            demoNow={data.demoNow}
            payable={data.payable}
          />

          <OfferPanel
            offers={offers}
            invoice={data.invoice}
            businessName={data.businessName}
            demoNow={data.demoNow}
            onAccept={(id) => void handleAccept(id)}
            acceptingId={acceptingId}
            error={acceptError}
            variant="side"
          />
        </div>

        <section className="pp-chat" aria-label="Conversation">
          <div className="pp-chat__head">
            <span className="pp-chat__avatar" aria-hidden>
              <SparklesIcon width={18} height={18} />
            </span>
            <div className="pp-chat__identity">
              <p className="pp-chat__name">
                Billing assistant
                {invoicePaid ? (
                  <span className="pp-online pp-online--settled">
                    <span aria-hidden />
                    Settled
                  </span>
                ) : data.status === 'ACTIVE' ? (
                  <span className="pp-online">
                    <span aria-hidden />
                    Online
                  </span>
                ) : (
                  <span className="pp-online pp-online--paused">
                    <span aria-hidden />
                    Paused
                  </span>
                )}
              </p>
              <p className="pp-chat__sub">AI assistant for {data.businessName}</p>
            </div>
            <span className="pp-chat__private">
              <LockIcon width={13} height={13} />
              Private
            </span>
          </div>

          <div className="pp-chat__banners">
            {primaryBanner}
            {connectionIssue ? (
              <StatusBanner
                tone="neutral"
                title="Connection lost"
                action={
                  <button
                    type="button"
                    className="pp-btn pp-btn--ghost pp-btn--sm"
                    onClick={() => void load({ silent: true })}
                  >
                    Retry
                  </button>
                }
              >
                New messages may not appear until the connection is restored.
              </StatusBanner>
            ) : null}
          </div>

          <ConversationThread
            messages={data.messages}
            clientName={data.clientName}
            businessName={data.businessName}
            invoice={data.invoice}
            demoNow={data.demoNow}
            pendingAgent={sending}
            threadRef={threadRef}
            endRef={endRef}
            onScroll={handleThreadScroll}
          />

          {showJump ? (
            <button type="button" className="pp-jump" onClick={() => scrollToBottom()}>
              <MessageIcon width={15} height={15} />
              New message
            </button>
          ) : null}

          <div className="pp-chat__offers">
            <OfferPanel
              offers={offers}
              invoice={data.invoice}
              businessName={data.businessName}
              demoNow={data.demoNow}
              onAccept={(id) => void handleAccept(id)}
              acceptingId={acceptingId}
              error={acceptError}
              variant="inline"
            />
          </div>

          <MessageComposer
            onSend={handleSend}
            sending={sending}
            disabled={!canMessage}
            disabledReason={disabledReason}
            error={sendError}
            showQuickReplies={showQuickReplies}
          />
        </section>
      </div>

      <footer className="pp-footer">
        <p>
          This is an automated assistant acting for {data.businessName}. A person can step in at
          any time.
        </p>
        <p className="pp-footer__brand">Secured by PulsePay</p>
      </footer>
    </main>
  );
}
