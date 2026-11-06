import { NextResponse } from 'next/server';
import { resetAndSeedDatabase } from '@/lib/seed';

export async function POST() {
  try {
    const result = await resetAndSeedDatabase();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

