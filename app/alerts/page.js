import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { fmtRelative } from '@/lib/time';
import { markAllRead } from '@/app/actions';
import PushSetup from '@/components/PushSetup';

export const dynamic = 'force-dynamic';

export default async function Alerts() {
  await requireAuth();
  const list = await sql`SELECT * FROM notifications ORDER BY id DESC LIMIT 60`;
  const unread = list.filter((n) => !n.read).length;
  return (
    <>
      <h1>Alerts</h1>
      <p className="sub">Everything the app has reminded you about.</p>
      <PushSetup vapidKey={process.env.VAPID_PUBLIC_KEY} />
      <div className="row between">
        <h2>🔔 Recent</h2>
        {unread > 0 && <form action={markAllRead} className="inline"><button className="btn small ghost">Mark all read</button></form>}
      </div>
      {!list.length && <div className="card empty">No alerts yet. New assignments, deadlines and planner reminders show up here.</div>}
      <div className="stack">
        {list.map((n) => (
          <Link key={n.id} href={n.url || '/'} className={`card${n.read ? '' : ' unread'}`} style={{ display: 'block', textDecoration: 'none' }}>
            <div className="row between">
              <b>{n.title}</b>
              <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{fmtRelative(n.created_at)}</span>
            </div>
            {n.body && <div className="muted small">{n.body}</div>}
          </Link>
        ))}
      </div>
    </>
  );
}
