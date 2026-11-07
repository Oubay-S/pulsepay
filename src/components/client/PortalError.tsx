'use client';

import { LockIcon, RefreshIcon } from './icons';

interface PortalErrorProps {
  kind: 'not_found' | 'error';
  message: string;
  onRetry: () => void;
  retrying: boolean;
}

export default function PortalError({ kind, message, onRetry, retrying }: PortalErrorProps) {
  const notFound = kind === 'not_found';

  return (
    <main className="pp-shell pp-shell--centered">
      <section className="pp-error-card" role={notFound ? undefined : 'alert'}>
        <span className="pp-error-card__icon" aria-hidden>
          <LockIcon width={22} height={22} />
        </span>
        <p className="pp-error-card__eyebrow">Private payment link</p>
        <h1 className="pp-error-card__title">
          {notFound ? 'This payment link is not available' : 'We could not load this invoice'}
        </h1>
        <p className="pp-error-card__body">
          {notFound
            ? 'It may have expired or been replaced by a newer invoice. Ask the business to send you a fresh link.'
            : message}
        </p>

        {notFound ? null : (
          <button
            type="button"
            className="pp-btn pp-btn--primary"
            onClick={onRetry}
            disabled={retrying}
          >
            <RefreshIcon width={17} height={17} />
            {retrying ? 'Trying again…' : 'Try again'}
          </button>
        )}

        <p className="pp-error-card__footnote">
          Your link is private. Only you and the business can see this conversation.
        </p>
      </section>
    </main>
  );
}
