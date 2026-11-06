import { createAdminClient } from '@/lib/supabase/admin';

export async function getDemoOffsetDays(): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('demo_clock')
      .select('offset_days')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return 0;
    }
    return data.offset_days ?? 0;
  } catch {
    return 0;
  }
}

export async function getDemoNow(): Promise<Date> {
  const offsetDays = await getDemoOffsetDays();
  const now = new Date();
  return new Date(now.getTime() + offsetDays * 86_400_000);
}

export async function advanceDemoClock(days: number): Promise<{ newNow: Date; offsetDays: number }> {
  const supabase = createAdminClient();
  const currentOffset = await getDemoOffsetDays();
  const newOffset = currentOffset + days;

  const { error } = await supabase
    .from('demo_clock')
    .upsert({ id: 1, offset_days: newOffset, updated_at: new Date().toISOString() });

  if (error) {
    throw new Error(`Failed to advance demo clock: ${error.message}`);
  }

  const now = new Date();
  const newNow = new Date(now.getTime() + newOffset * 86_400_000);
  return { newNow, offsetDays: newOffset };
}

export async function resetDemoClock(): Promise<Date> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('demo_clock')
    .upsert({ id: 1, offset_days: 0, updated_at: new Date().toISOString() });

  if (error) {
    throw new Error(`Failed to reset demo clock: ${error.message}`);
  }

  return new Date();
}

