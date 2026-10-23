import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { refreshNews, latestNews } from '@/lib/news';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/** Latest briefing; builds a new one first if it's stale. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await refreshNews());
  } catch (e) {
    console.error('news', e);
    return NextResponse.json((await latestNews()) ?? { error: e.message }, { status: 200 });
  }
}
