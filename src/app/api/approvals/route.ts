import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoNow } from '@/lib/demo-clock';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING_APPROVAL';

    const [approvalsResult, policiesResult, demoNow] = await Promise.all([
      supabase
        .from('arrangements')
        .select(
          '*, invoice:invoices(*, client:clients(*), conversations(token, status)), conversation:conversations(status, token)'
        )
        .eq('status', status)
        .order('created_at', { ascending: false }),
      supabase.from('policies').select('*').limit(1),
      getDemoNow(),
    ]);

    if (approvalsResult.error) {
      return NextResponse.json({ error: approvalsResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      approvals: approvalsResult.data || [],
      policy: policiesResult.data?.[0] || null,
      demo_now: demoNow.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
