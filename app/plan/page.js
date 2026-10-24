import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { timeline } from '@/lib/planner';
import { istDay, istHHMM, addDays, fmtDay, fmtTime } from '@/lib/time';
import { addTask, deleteTask, moveToTomorrow } from '@/app/actions';
import Timeline from '@/components/Timeline';
import PlanTabs from '@/components/PlanTabs';

export const dynamic = 'force-dynamic';

const REPEAT_LABEL = { daily: 'Every day', weekdays: 'Weekdays' };

export default async function Plan({ searchParams }) {
  await requireAuth();
  const today = istDay();
  const q = (await searchParams).day;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q ?? '') ? q : today;
  const [items, repeating] = await Promise.all([
    timeline(day),
    sql`SELECT * FROM tasks WHERE repeat <> 'none' ORDER BY start_time`,
  ]);
  const now = new Date();
  const leftover = day === today ? items.filter((i) => i.type === 'task' && !i.done && i.repeat === 'none' && i.end < now) : [];
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
        <label className="field">What
          <input name="title" required placeholder="Gym, cook dinner, finish SQL workbook…" maxLength={120} />
        </label>
        <div className="grid2">
          <label className="field">Day
            <input type="date" name="day" defaultValue={day} min={today} required />
          </label>
          <label className="field">Start
            <input type="time" name="start" defaultValue={day === today ? nextSlot : '09:00'} required />
          </label>
        </div>
        <div className="grid2">
          <label className="field">How long
            <select name="duration" defaultValue="60">
              {[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? 's' : ''}`}</option>)}
            </select>
          </label>
          <label className="field">Repeat
            <select name="repeat" defaultValue="none">
              <option value="none">Just once</option>
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
            </select>
          </label>
        </div>
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

      {repeating.length > 0 && (
        <>
          <h2>🔁 Repeating tasks</h2>
          <div className="stack">
            {repeating.map((t) => (
              <div key={t.id} className="card row">
                <div className="grow">
                  <b>{t.title}</b>
                  <div className="muted small">{REPEAT_LABEL[t.repeat]} · {String(t.start_time).slice(0, 5)} · {t.duration_min} min</div>
                </div>
                <form action={deleteTask} className="inline">
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn small ghost">Delete</button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}

      {items.some((i) => i.type === 'task' && i.repeat === 'none') && (
        <>
          <h2>Remove a task</h2>
          <div className="stack">
            {items.filter((i) => i.type === 'task' && i.repeat === 'none').map((t) => (
              <div key={t.key} className="card row">
                <div className="grow"><b>{t.title}</b><div className="muted small">{fmtTime(t.start)}–{fmtTime(t.end)}</div></div>
                <form action={deleteTask} className="inline">
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn small ghost">Delete</button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
