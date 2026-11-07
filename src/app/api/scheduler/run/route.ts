import { NextRequest, NextResponse } from 'next/server';
import { processDueInstallments } from '@/lib/scheduler';

// Each due installment creates and sends a real PayPal invoice.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // If a cron secret is set and does not match
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await processDueInstallments();
    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

