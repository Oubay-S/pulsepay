import Link from 'next/link';
import ApprovalsQueue from '@/components/approvals/ApprovalsQueue';
import { getApprovalsPayload } from '@/lib/approvals/server';
import type { ApprovalsPayload } from '@/lib/approvals/types';
import { AlertIcon } from '@/components/client/icons';

// The queue is owner data; render it per request rather than at build time.
export const instant = false;

export default async function ApprovalsPage() {
  let payload: ApprovalsPayload | null = null;
  let errorMessage: string | null = null;

  try {
    payload = await getApprovalsPayload();
  } catch (error: unknown) {
    errorMessage =
      error instanceof Error ? error.message : 'The approvals queue could not be loaded.';
  }

  if (payload) {
    return <ApprovalsQueue initial={payload} />;
  }

  return (
    <div className="ap-root">
      <main className="ap-main ap-main--centered">
        <section className="ap-error-card" role="alert">
          <span className="ap-error-card__icon" aria-hidden>
            <AlertIcon width={24} height={24} />
          </span>
          <p className="ap-eyebrow">Owner console</p>
          <h1>Approvals are unavailable</h1>
          <p>{errorMessage}</p>
          <Link className="ap-btn ap-btn--primary" href="/approvals">
            Try again
          </Link>
        </section>
      </main>
    </div>
  );
}
