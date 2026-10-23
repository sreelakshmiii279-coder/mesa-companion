import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { sql } from '@/lib/db';
import { notify } from '@/lib/push';

export async function POST(req) {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sub = await req.json();
  if (!sub?.endpoint) return NextResponse.json({ error: 'bad subscription' }, { status: 400 });
  await sql`INSERT INTO push_subs (endpoint, sub) VALUES (${sub.endpoint}, ${JSON.stringify(sub)})
            ON CONFLICT (endpoint) DO UPDATE SET sub = EXCLUDED.sub`;
  await notify({
    key: `welcome:${Date.now()}`, kind: 'system', url: '/alerts',
    title: 'Notifications are on', body: "You'll get reminders here even when the app is closed.",
  });
  return NextResponse.json({ ok: true });
}
