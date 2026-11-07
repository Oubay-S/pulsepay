import ClientPortal from '@/components/client/ClientPortal';
import { normalizeClientPortalData } from '@/lib/client-portal/normalize';
import {
  ConversationNotFoundError,
  getClientPortalPayload,
} from '@/lib/client-portal/server';
import type {
  ClientPortalLoadFailure,
  ClientPortalPayload,
} from '@/lib/client-portal/types';

// The invoice must be fresh on every request; this route is request-time
// rendered rather than prerendered at build time.
export const instant = false;

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let payload: ClientPortalPayload | null = null;
  let failure: ClientPortalLoadFailure | null = null;

  try {
    payload = await getClientPortalPayload(token);
  } catch (error: unknown) {
    failure =
      error instanceof ConversationNotFoundError
        ? {
            kind: 'not_found',
            message: 'Conversation not found',
          }
        : {
            kind: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The invoice could not be loaded.',
          };
  }

  if (payload) {
    return (
      <ClientPortal
        token={token}
        initialData={normalizeClientPortalData(payload)}
        initialFailure={null}
      />
    );
  }

  return <ClientPortal token={token} initialData={null} initialFailure={failure} />;
}
