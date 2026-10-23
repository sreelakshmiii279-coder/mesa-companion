// Called by GitHub Actions: writes notes for one class recording that doesn't have them yet.
import { NextResponse } from 'next/server';
import { isCron } from '@/lib/auth';
import { makeNextNotes } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ done: await makeNextNotes() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
