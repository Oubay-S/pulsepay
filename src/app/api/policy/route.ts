import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const UpdatePolicySchema = z.object({
  business_id: z.string().uuid().optional(),
  max_discount_pct: z.number().min(0).max(50).optional(),
  max_installments: z.number().int().min(1).max(12).optional(),
  min_first_payment_pct: z.number().min(0).max(100).optional(),
  approval_threshold: z.number().min(0).optional(),
  max_messages_per_day: z.number().int().min(1).max(20).optional(),
  quiet_hours_start: z.number().int().min(0).max(23).optional(),
  quiet_hours_end: z.number().int().min(0).max(23).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('business_id');

    let query = supabase.from('policies').select('*');
    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: policies, error } = await query.limit(1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const policy = policies?.[0] || null;
    return NextResponse.json({ policy });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const parseResult = UpdatePolicySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid policy payload', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const validData = parseResult.data;

    // Get business_id from payload or default to first business
    let targetBizId = validData.business_id;
    if (!targetBizId) {
      const { data: biz } = await supabase.from('businesses').select('id').limit(1).single();
      targetBizId = biz?.id;
    }

    if (!targetBizId) {
      return NextResponse.json({ error: 'No business found to attach policy' }, { status: 404 });
    }

    const updatePayload = {
      ...validData,
      business_id: targetBizId,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('policies')
      .upsert(updatePayload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log owner event
    await supabase.from('events').insert({
      type: 'POLICY_UPDATED',
      actor: 'OWNER',
      entity_type: 'policy',
      entity_id: targetBizId,
      payload: updatePayload,
    });

    return NextResponse.json({ success: true, policy: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

