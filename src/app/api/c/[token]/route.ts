import { NextRequest, NextResponse } from 'next/server';
import {
  ConversationNotFoundError,
  getClientPortalPayload,
} from '@/lib/client-portal/server';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const payload = await getClientPortalPayload(token);

    const response = NextResponse.json(payload);
    // The client page polls this endpoint; never serve a stale invoice.
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (err: unknown) {
    if (err instanceof ConversationNotFoundError) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
