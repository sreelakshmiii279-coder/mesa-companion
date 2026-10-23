import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { timeline, pendingAssignments } from '@/lib/planner';
import { istDay, fmtDay, fmtTime } from '@/lib/time';
import Timeline from '@/components/Timeline';
import DueList from '@/components/DueList';
import Countdown from '@/components/Countdown';

export const dynamic = 'force-dynamic';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function greeting(now) {
  const h = Number(now.toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function Today() {
  await requireAuth();
  const now = new Date();
  const day = istDay(now);
  const [items, pending, [prereads]] = await Promise.all([
    timeline(day),
    pendingAssignments(),
    sql`SELECT count(*)::int AS n FROM readings WHERE kind = 'pre' AND NOT is_read`,
  ]);
  const open = items.filter((i) => !i.done);
  const current = open.find((i) => i.start <= now && now < i.end);
  const next = open.find((i) => i.start > now);
  const count = (t) => items.filter((i) => i.type === t).length;

  return (
    <>
      <h1>{greeting(now)}</h1>
      <p className="sub">
        {fmtDay(now)} · {plural(count('class'), 'class', 'classes')} · {plural(count('task') + count('chore'), 'task')} · {plural(pending.length, 'deadline')}
      </p>

      <div className="hero">
        {current ? (
          <>
            <div className="label">Now · {current.title}</div>
            <div className="big"><Countdown to={current.end.toISOString()} /> left</div>
            <div className="foot">Ends {fmtTime(current.end)}{next ? ` · next: ${next.title} at ${fmtTime(next.start)}` : ''}</div>
          </>
        ) : next ? (
          <>
            <div className="label">You have</div>
            <div className="big"><Countdown to={next.start.toISOString()} /></div>
            <div className="foot">until {next.title} at {fmtTime(next.start)}
              {pending[0] && next.start - now > 30 * 60_000 ? ` · good time for “${pending[0].title}”` : ''}</div>
          </>
        ) : (
          <>
            <div className="label">Rest of today</div>
            <div className="big">All clear ✨</div>
            <div className="foot">{pending[0] ? `Next deadline: “${pending[0].title}”` : 'Nothing else scheduled.'}</div>
          </>
        )}
      </div>

      {prereads.n > 0 && (
        <Link href="/learn" className="card row" style={{ marginTop: 12, textDecoration: 'none' }}>
          <span className="dot" />
          <div className="grow"><b>{plural(prereads.n, 'pre-read')} waiting</b><div className="muted small">Short on time? Summaries are ready.</div></div>
          <span className="muted">→</span>
        </Link>
      )}

      <div className="row between"><h2>Today</h2><Link href="/plan" className="btn small ghost">+ Add</Link></div>
      <Timeline items={items} day={day} now={now} />

      <div className="row between"><h2>Due soon</h2><Link href="/deadlines" className="small muted">See all</Link></div>
      <DueList items={pending.slice(0, 3)} />
    </>
  );
}
