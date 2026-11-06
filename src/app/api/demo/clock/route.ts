import { NextRequest, NextResponse } from 'next/server';
import { advanceDemoClock, getDemoNow, resetDemoClock } from '@/lib/demo-clock';
import { processDueInstallments } from '@/lib/scheduler';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = typeof body.days === 'number' ? body.days : 1;

    let result;
    if (days === 0) {
      const resetDate = await resetDemoClock();
      result = { newNow: resetDate, offsetDays: 0 };
    } else {
      result = await advanceDemoClock(days);
    }

    // Advance also automatically triggers the scheduler to process newly due installments
    const schedulerResults = await processDueInstallments();

    return NextResponse.json({
      success: true,
      demo_now: result.newNow.toISOString(),
      offset_days: result.offsetDays,
      scheduler_results: schedulerResults,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const demoNow = await getDemoNow();
    return NextResponse.json({
      demo_now: demoNow.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

