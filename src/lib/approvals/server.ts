import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoNow } from '@/lib/demo-clock';
import type { ApprovalArrangement, ApprovalsPayload } from './types';

export async function getApprovalsPayload(): Promise<ApprovalsPayload> {
  const supabase = createAdminClient();

  const [approvalsResult, policiesResult, demoNow] = await Promise.all([
    supabase
      .from('arrangements')
      .select(
        '*, invoice:invoices(*, client:clients(*), conversations(token, status)), conversation:conversations(status, token)'
      )
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: true }),
    supabase.from('policies').select('*').limit(1),
    getDemoNow(),
  ]);

  if (approvalsResult.error) {
    throw new Error(approvalsResult.error.message);
  }

  return {
    approvals: (approvalsResult.data || []) as ApprovalArrangement[],
    policy: policiesResult.data?.[0] || null,
    demo_now: demoNow.toISOString(),
  };
}
