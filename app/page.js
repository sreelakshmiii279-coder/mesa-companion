import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
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
  const [items, pending] = await Promise.all([timeline(day), pendingAssignments()]);
  const open = items.filter((i) => !i.done);
  const current = open.find((i) => i.start <= now && now < i.end);
  const next = open.find((i) => i.start > now);

  return (
    <>
      <p className="sub" style={{ margin: 0 }}>{fmtDay(now)}</p>
      <h1>{greeting(now)}</h1>
      <p className="sub">{plural(items.filter((i) => i.type === 'class').length, 'class', 'classes')} · {plural(items.filter((i) => i.type === 'task').length, 'task')} · {plural(pending.length, 'assignment')} pending</p>

      <div className="hero">
        {current ? (
          <>
            <div className="label">Now · {current.title}</div>
            <div className="big"><Countdown to={current.end.toISOString()} /> left</div>
            <div className="small muted">
              Ends {fmtTime(current.end)}{next ? ` · next: ${next.title} at ${fmtTime(next.start)}` : ''}
            </div>
          </>
        ) : next ? (
          <>
            <div className="label">You have</div>
            <div className="big"><Countdown to={next.start.toISOString()} /></div>
            <div className="small muted">until {next.title} at {fmtTime(next.start)}
              {pending[0] && next.start - now > 30 * 60_000 ? ` · good time for “${pending[0].title}”` : ''}</div>
          </>
        ) : (
          <>
            <div className="label">Rest of today</div>
            <div className="big">All clear</div>
            <div className="small muted">{pending[0] ? `Next deadline: “${pending[0].title}”` : 'Nothing else scheduled.'}</div>
          </>
        )}
      </div>

      <div className="row between"><h2>Today</h2><Link href="/plan" className="btn small ghost">+ Add task</Link></div>
      <Timeline items={items} day={day} now={now} />

      <div className="row between"><h2>Due soon</h2><Link href="/deadlines" className="small muted">See all</Link></div>
      <DueList items={pending.slice(0, 3)} />
    </>
  );
}
