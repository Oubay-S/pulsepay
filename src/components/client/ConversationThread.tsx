'use client';

import { useMemo, type RefObject, type UIEventHandler } from 'react';
import type { MessageRow, MessageSender } from '@/types/database';
import type { ClientPortalInvoice } from '@/lib/client-portal/types';
import {
  daysPastDue,
  daysUntil,
  firstName,
  formatDate,
  formatDateTime,
  formatDayLabel,
  formatMoney,
  initials,
  isSameDay,
  pluralize,
} from '@/lib/client-portal/format';
import { BuildingIcon, CheckCircleIcon, SparklesIcon } from './icons';

interface ConversationThreadProps {
  messages: MessageRow[];
  clientName: string | null;
  businessName: string;
  invoice: ClientPortalInvoice;
  demoNow: string;
  pendingAgent: boolean;
  threadRef: RefObject<HTMLDivElement | null>;
  endRef: RefObject<HTMLDivElement | null>;
  onScroll?: UIEventHandler<HTMLDivElement>;
}

function senderLabel(sender: MessageSender, businessName: string): string {
  switch (sender) {
    case 'AGENT':
      return 'Billing assistant';
    case 'CLIENT':
      return 'You';
    case 'OWNER':
      return `${businessName} owner`;
    default:
      return 'Update';
  }
}

function senderInitials(sender: MessageSender, clientName: string | null, businessName: string) {
  if (sender === 'CLIENT') return initials(clientName || 'You');
  if (sender === 'OWNER') return initials(businessName);
  return 'PP';
}

function MessageAvatar({
  sender,
  clientName,
  businessName,
}: {
  sender: MessageSender;
  clientName: string | null;
  businessName: string;
}) {
  if (sender === 'AGENT') {
    return (
      <span className="pp-msg__avatar pp-msg__avatar--agent" aria-hidden>
        <SparklesIcon width={15} height={15} />
      </span>
    );
  }

  if (sender === 'OWNER') {
    return (
      <span className="pp-msg__avatar pp-msg__avatar--owner" aria-hidden>
        <BuildingIcon width={15} height={15} />
      </span>
    );
  }

  return (
    <span className="pp-msg__avatar pp-msg__avatar--client" aria-hidden>
      {senderInitials(sender, clientName, businessName)}
    </span>
  );
}

function IntentChip({ intent }: { intent: string | null }) {
  if (intent === 'ARRANGEMENT_ACCEPTED') {
    return (
      <span className="pp-intent-chip pp-intent-chip--success">
        <CheckCircleIcon width={12} height={12} />
        Arrangement active
      </span>
    );
  }

  if (intent === 'DISPUTE_ACKNOWLEDGED') {
    return <span className="pp-intent-chip pp-intent-chip--warning">Owner notified</span>;
  }

  return null;
}

function WelcomeMessage({
  clientName,
  businessName,
  invoice,
  demoNow,
}: {
  clientName: string | null;
  businessName: string;
  invoice: ClientPortalInvoice;
  demoNow: string;
}) {
  const first = firstName(clientName);
  const paid = invoice.status === 'PAID';
  const arrangementActive =
    invoice.status === 'SUPERSEDED' || invoice.status === 'PARTIALLY_PAID';
  const late = daysPastDue(invoice.dueDate, demoNow);
  const remaining = daysUntil(invoice.dueDate, demoNow);
  const dueSentence = paid
    ? 'It has been paid in full.'
    : arrangementActive
      ? 'A payment plan is active.'
      : late > 0
        ? `It is ${pluralize(late, 'day')} past due.`
        : remaining >= 0
          ? `It is due in ${pluralize(remaining, 'day')}.`
          : '';

  const closing = paid
    ? 'Nothing else is needed — thank you.'
    : arrangementActive
      ? 'Your installment schedule is shown with the invoice. Reply below if you have a question.'
      : `If paying in full is difficult, reply below and I'll show you options that follow ${businessName}'s rules.`;

  return (
    <div className="pp-msg pp-msg--agent">
      <MessageAvatar sender="AGENT" clientName={clientName} businessName={businessName} />
      <div className="pp-msg__body">
        <p className="pp-msg__sender">Billing assistant</p>
        <div className="pp-bubble pp-bubble--agent">
          <p>
            Hi {first} — I&apos;m the billing assistant for {businessName}.
          </p>
          <p className="pp-bubble__gap">
            This is your private page for invoice <span className="pp-mono">{invoice.number}</span> for{' '}
            {formatMoney(invoice.amount, invoice.currency)}, due{' '}
            {formatDate(invoice.dueDate, new Date(demoNow))}. {dueSentence}
          </p>
          <p className="pp-bubble__gap">{closing}</p>
        </div>
      </div>
    </div>
  );
}

export default function ConversationThread({
  messages,
  clientName,
  businessName,
  invoice,
  demoNow,
  pendingAgent,
  threadRef,
  endRef,
  onScroll,
}: ConversationThreadProps) {
  const items = useMemo(
    () =>
      messages.map((message, index) => ({
        message,
        showDate:
          index === 0 || !isSameDay(messages[index - 1].created_at, message.created_at),
      })),
    [messages]
  );

  return (
    <div
      className="pp-thread"
      ref={threadRef}
      onScroll={onScroll}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Conversation with the billing assistant"
    >
      {messages.length === 0 ? (
        <WelcomeMessage
          clientName={clientName}
          businessName={businessName}
          invoice={invoice}
          demoNow={demoNow}
        />
      ) : null}

      {items.map(({ message, showDate }) => {
        const isPending = message.id.startsWith('temp-');

        if (message.sender === 'SYSTEM') {
          return (
            <div key={message.id} className="pp-system-message">
              {message.content}
            </div>
          );
        }

        return (
          <div key={message.id}>
            {showDate ? (
              <div className="pp-date-separator">
                <span>{formatDayLabel(message.created_at, new Date(demoNow))}</span>
              </div>
            ) : null}

            <div className={`pp-msg pp-msg--${message.sender.toLowerCase()}`}>
              <MessageAvatar
                sender={message.sender}
                clientName={clientName}
                businessName={businessName}
              />
              <div className="pp-msg__body">
                <p className="pp-msg__sender">
                  {senderLabel(message.sender, businessName)}
                  <time dateTime={message.created_at}>
                    {isPending ? 'Sending…' : formatDateTime(message.created_at)}
                  </time>
                </p>
                <div
                  className={`pp-bubble pp-bubble--${message.sender.toLowerCase()}${
                    isPending ? ' pp-bubble--pending' : ''
                  }`}
                >
                  <p>{message.content}</p>
                  <IntentChip intent={message.intent} />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {pendingAgent ? (
        <div className="pp-msg pp-msg--agent pp-msg--typing">
          <MessageAvatar sender="AGENT" clientName={clientName} businessName={businessName} />
          <div className="pp-msg__body">
            <p className="pp-msg__sender">Billing assistant</p>
            <div className="pp-bubble pp-bubble--agent pp-bubble--typing" aria-label="Assistant is typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
