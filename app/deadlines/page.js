import { requireAuth } from '@/lib/auth';
import { sql, getMeta } from '@/lib/db';
import { fmtRelative } from '@/lib/time';
import { PORTAL_ASSIGNMENTS } from '@/lib/lms';
import DueList from '@/components/DueList';
import SyncButton from '@/components/SyncButton';

export const dynamic = 'force-dynamic';

export default async function Deadlines() {
  await requireAuth();
  const [pending, finished, lastSync] = await Promise.all([
    sql`SELECT * FROM assignments WHERE NOT submitted AND NOT marked_done AND due_at > now() ORDER BY due_at`,
    sql`SELECT * FROM assignments WHERE submitted OR marked_done OR due_at <= now() ORDER BY due_at DESC NULLS LAST LIMIT 40`,
    getMeta('last_sync'),
  ]);
  return (
    <>
      <h1>Deadlines</h1>
      <p className="sub">
        Reminders go out 3 days, 1 day, 3 hours and 1 hour before. Tick one off to stop its reminders.
        {lastSync && <> Synced {fmtRelative(new Date(Number(lastSync)))}.</>}
      </p>
      <div className="row" style={{ gap: 8 }}>
        <SyncButton />
        <a className="btn small ghost" href={PORTAL_ASSIGNMENTS} target="_blank" rel="noreferrer">Open portal ↗</a>
      </div>
      <h2>To do · {pending.length}</h2>
      <DueList items={pending} />
      <details>
        <summary>Done and past ({finished.length})</summary>
        <DueList items={finished} />
      </details>
    </>
  );
}
