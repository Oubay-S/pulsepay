import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { DashboardKPIs, InvoicesResponse } from '@/types/api';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('business_id');

    // Fetch invoices with client relationship
    let query = supabase
      .from('invoices')
      .select('*, client:clients(*)')
      .order('priority_score', { ascending: false });

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: invoices, error: invError } = await query;
    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }

    // Fetch approvals count
    const approvalsQuery = supabase
      .from('arrangements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING_APPROVAL');

    const { count: needsApprovalCount } = await approvalsQuery;

    // Calculate KPIs
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let recoveredThisMonth = 0;
    const now = new Date();

    for (const inv of invoices || []) {
      const amount = Number(inv.amount) || 0;
      if (inv.status === 'SENT' || inv.status === 'PARTIALLY_PAID') {
        totalOutstanding += amount;
        if (new Date(inv.due_date) < now) {
          totalOverdue += amount;
        }
      } else if (inv.status === 'PAID') {
        recoveredThisMonth += amount;
      }
    }

    const kpis: DashboardKPIs = {
      total_outstanding: totalOutstanding,
      total_overdue: totalOverdue,
      recovered_this_month: recoveredThisMonth,
      needs_approval: needsApprovalCount ?? 0,
      total_invoices: invoices?.length ?? 0,
    };

    const response: InvoicesResponse = {
      invoices: invoices || [],
      kpis,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

