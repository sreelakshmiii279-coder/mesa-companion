// Called every minute while the app is open, so reminders land on time even if the cron runs late.
import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendReminders, syncPortal } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const after = Number(new URL(req.url).searchParams.get('after') ?? 0);
  await sendReminders().catch((e) => console.error('reminders', e));
  await syncPortal().catch((e) => console.error('sync', e));
  const [fresh, [{ unread }]] = await Promise.all([
    sql`SELECT id, title, body, url FROM notifications WHERE id > ${after} ORDER BY id LIMIT 10`,
    sql`SELECT count(*)::int AS unread FROM notifications WHERE NOT read`,
  ]);
  const [{ max }] = await sql`SELECT coalesce(max(id), 0)::int AS max FROM notifications`;
  return NextResponse.json({ fresh: after ? fresh : [], unread, lastId: max });
}
