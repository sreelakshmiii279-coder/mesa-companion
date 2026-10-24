import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { timeline, allDue } from '@/lib/planner';
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
    allDue(),
    sql`SELECT count(*)::int AS n FROM readings WHERE kind = 'pre' AND NOT is_read`,
  ]);
  const open = items.filter((i) => !i.done);
  const current = open.find((i) => i.start <= now && now < i.end);
  const next = open.find((i) => i.start > now);
  const count = (t) => items.filter((i) => i.type === t).length;
  const own = items.filter((i) => i.type !== 'class');
  const doneCount = own.filter((i) => i.done).length;
  const week = pending.filter((a) => new Date(a.due_at) - now < 7 * 86_400_000).length;

  return (
    <>
      <div className="ring-row">
        <div className="grow">
          <h1>{greeting(now)} 👋</h1>
          <p className="sub" style={{ margin: 0 }}>{fmtDay(now)} · {doneCount} of {own.length} of your tasks done</p>
        </div>
        <div className="ring" style={{ '--p': own.length ? Math.round((doneCount / own.length) * 100) : 0 }}>
          <b>{own.length ? `${Math.round((doneCount / own.length) * 100)}%` : '–'}</b>
        </div>
      </div>

      <div className="stats">
        <Link href="/" className="stat blue"><span className="e">📚</span><div className="n">{count('class')}</div><div className="l">classes today</div></Link>
        <Link href="/plan" className="stat green"><span className="e">⚡</span><div className="n">{count('task') + count('chore')}</div><div className="l">tasks & chores</div></Link>
        <Link href="/deadlines" className="stat orange"><span className="e">⏳</span><div className="n">{week}</div><div className="l">due this week</div></Link>
      </div>
      <div style={{ height: 14 }} />

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

      <div className="row between"><h2>🗓️ Your day</h2><Link href="/plan" className="btn small ghost">+ Add</Link></div>
      <Timeline items={items} day={day} now={now} />

      <div className="row between"><h2>⏳ Due soon</h2><Link href="/deadlines" className="small muted">See all</Link></div>
      <DueList items={pending.slice(0, 3)} />
    </>
  );
}
