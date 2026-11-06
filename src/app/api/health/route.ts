import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('businesses').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        { status: 'error', database: 'unreachable', error: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      service: 'pulsepay',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', error: message },
      { status: 500 }
    );
  }
}

