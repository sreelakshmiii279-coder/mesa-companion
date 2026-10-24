import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { timeline } from '@/lib/planner';
import { istDay, istHHMM, addDays, fmtDay, fmtTime } from '@/lib/time';
import { addTask, updateTask, deleteTask, moveToTomorrow } from '@/app/actions';
import Timeline from '@/components/Timeline';
import PlanTabs from '@/components/PlanTabs';
import TaskFields from '@/components/TaskFields';

export const dynamic = 'force-dynamic';

const REPEAT_LABEL = { daily: 'Every day', weekdays: 'Weekdays' };

export default async function Plan({ searchParams }) {
  await requireAuth();
  const today = istDay();
  const q = (await searchParams).day;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q ?? '') ? q : today;
  const [items, repeating] = await Promise.all([
    timeline(day),
    sql`SELECT id, title, day::text AS day, start_time::text AS start_time, duration_min, repeat
        FROM tasks WHERE repeat <> 'none' ORDER BY start_time`,
  ]);
  const now = new Date();
  const leftover = day === today ? items.filter((i) => i.type === 'task' && !i.done && i.repeat === 'none' && i.end < now) : [];
  // Everything you can edit on this page: that day's one-off tasks, then repeating ones.
  const mine = [
    ...items.filter((i) => i.type === 'task' && i.repeat === 'none').map((t) => ({
      key: t.key, id: t.id, title: t.title, meta: `${fmtTime(t.start)}–${fmtTime(t.end)}`,
      fields: { title: t.title, day, start: istHHMM(t.start), duration: Math.round((t.end - t.start) / 60_000), repeat: 'none' },
    })),
    ...repeating.map((t) => ({
      key: `r${t.id}`, id: t.id, title: t.title,
      meta: `${REPEAT_LABEL[t.repeat]} · ${t.start_time.slice(0, 5)} · ${t.duration_min} min`,
      fields: { title: t.title, day: t.day, start: t.start_time.slice(0, 5), duration: t.duration_min, repeat: t.repeat },
    })),
  ];
  // Default the new task to the next half hour.
  const nextSlot = (() => {
    const [h, m] = istHHMM(now).split(':').map(Number);
    const t = Math.min(23 * 60 + 30, Math.ceil((h * 60 + m + 1) / 30) * 30);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  })();

  return (
    <>
      <h1>Plan your day</h1>
      <p className="sub">Block time for gym, cooking, deep work. You'll get a heads-up before each one, and a nudge when free time opens up.</p>
      <PlanTabs active="/plan" />

      <form action={addTask} className="card stack">
        <TaskFields task={{ day, start: day === today ? nextSlot : '09:00' }} minDay={today} />
        <button className="btn block">Add to plan</button>
      </form>

      {leftover.length > 0 && (
        <>
          <h2>⏰ Not done yet</h2>
          <div className="stack">
            {leftover.map((t) => (
              <div key={t.key} className="card row">
                <div className="grow"><b>{t.title}</b><div className="muted small">was at {fmtTime(t.start)}</div></div>
                <form action={moveToTomorrow} className="inline">
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn small ghost">Move to tomorrow</button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="row between">
        <h2>{day === today ? 'Today' : fmtDay(day + 'T12:00:00+05:30')}</h2>
        <div className="row">
          {day > today && <a className="small muted" href={`/plan?day=${addDays(day, -1)}`}>← Prev</a>}
          <a className="small muted" href={`/plan?day=${addDays(day, 1)}`}>Next →</a>
        </div>
      </div>
      <Timeline items={items} day={day} />

      {mine.length > 0 && (
        <>
          <h2>✏️ Your tasks</h2>
          <div className="stack">
            {mine.map((t) => (
              <div key={t.key} className="card">
                <div className="row">
                  <div className="grow">
                    <b>{t.title}</b>
                    <div className="muted small">{t.meta}</div>
                  </div>
                  <form action={deleteTask} className="inline">
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn small ghost">Delete</button>
                  </form>
                </div>
                <details className="edit">
                  <summary>Edit</summary>
                  <form action={updateTask} className="stack">
                    <input type="hidden" name="id" value={t.id} />
                    <TaskFields task={t.fields} />
                    <button className="btn block">Save changes</button>
                  </form>
                </details>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
