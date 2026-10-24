import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { dailyMotivation } from '@/lib/morning';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ message: await dailyMotivation() });
}
