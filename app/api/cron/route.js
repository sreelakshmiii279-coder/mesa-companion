// Called every 5 minutes by GitHub Actions: syncs the portal (throttled) and sends due reminders.
import { NextResponse } from 'next/server';
import { isCron } from '@/lib/auth';
import { syncPortal, sendReminders } from '@/lib/jobs';
import { refreshNews } from '@/lib/news';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const out = {};
  try { out.sync = await syncPortal(); } catch (e) { out.syncError = e.message; }
  try { out.remindersSent = await sendReminders(); } catch (e) { out.reminderError = e.message; }
  try { out.newsId = (await refreshNews())?.id; } catch (e) { out.newsError = e.message; }
  return NextResponse.json(out);
}
