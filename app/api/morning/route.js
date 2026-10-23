import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { dailyMotivation, getVision } from '@/lib/vision';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const [message, vision] = await Promise.all([dailyMotivation(), getVision()]);
  return NextResponse.json({ message, vision });
}
