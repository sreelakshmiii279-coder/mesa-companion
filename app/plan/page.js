import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { timeline } from '@/lib/planner';
import { istDay, istHHMM, addDays, fmtDay, fmtTime } from '@/lib/time';
import { category, PRIORITIES } from '@/lib/categories';
import { choreEmoji } from '@/lib/chores';
import { addItem, updateItem, deleteItem, moveToTomorrow, toggleChore, rescheduleChore } from '@/app/actions';
import Timeline from '@/components/Timeline';
import PlanTabs from '@/components/PlanTabs';
import ItemFields from '@/components/ItemFields';

export const dynamic = 'force-dynamic';

const REPEAT_LABEL = { daily: 'Every day', weekdays: 'Weekdays' };
const rank = (p) => PRIORITIES[p]?.rank ?? 1;
const emojiFor = (t) => (t.category === 'house' ? choreEmoji(t.title) : category(t.category).emoji);

function when(d) {
  const label = istDay(d) === istDay() ? 'Today' : istDay(d) === addDays(istDay(), 1) ? 'Tomorrow' : fmtDay(d);
  return `${label}, ${fmtTime(d)}`;
}

const Check = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"><path d="m5 12 5 5L20 7" /></svg>;

export default async function Tasks({ searchParams }) {
  await requireAuth();
  const today = istDay();
  const q = (await searchParams).day;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q ?? '') ? q : today;
  const [items, fixed, flex, doneFlex] = await Promise.all([
    timeline(day),
    sql`SELECT id, title, day::text AS day, start_time::text AS start_time, duration_min, repeat, category, priority
        FROM tasks WHERE repeat <> 'none' OR day >= ${today} ORDER BY day, start_time`,
    sql`SELECT *, due_day::text AS due_day FROM chores WHERE NOT done ORDER BY slot_start NULLS LAST`,
    sql`SELECT * FROM chores WHERE done ORDER BY created_at DESC LIMIT 15`,
  ]);
  const now = new Date();
  const leftover = day === today ? items.filter((i) => i.type === 'task' && !i.done && i.repeat === 'none' && i.end < now) : [];
  const nextSlot = (() => {
    const [h, m] = istHHMM(now).split(':').map(Number);
    const t = Math.min(23 * 60 + 30, Math.ceil((h * 60 + m + 1) / 30) * 30);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  })();

  // One list of everything you've added, most important first.
  const all = [
    ...flex.map((c) => ({
      kind: 'chore', id: c.id, title: c.title, priority: c.priority, emoji: emojiFor(c), sortTime: c.slot_start ? new Date(c.slot_start) : now,
      meta: `${c.slot_start ? when(c.slot_start) : 'finding a slot…'} · ${c.est_min} min · auto-slotted${c.due_day ? ` · by ${fmtDay(c.due_day + 'T12:00:00+05:30')}` : ''}`,
      fields: { mode: 'flex', title: c.title, category: c.category, priority: c.priority, minutes: c.est_min, due: c.due_day },
    })),
    ...fixed.map((t) => ({
      kind: 'task', id: t.id, title: t.title, priority: t.priority, emoji: emojiFor(t),
      sortTime: new Date(`${t.repeat === 'none' ? t.day : today}T${t.start_time.slice(0, 5)}:00+05:30`),
      meta: `${t.repeat === 'none' ? fmtDay(t.day + 'T12:00:00+05:30') : REPEAT_LABEL[t.repeat]} · ${t.start_time.slice(0, 5)} · ${t.duration_min} min`,
      fields: { mode: 'fixed', title: t.title, category: t.category, priority: t.priority, minutes: t.duration_min, day: t.day, start: t.start_time.slice(0, 5), repeat: t.repeat },
    })),
  ].sort((a, b) => rank(a.priority) - rank(b.priority) || a.sortTime - b.sortTime);

  return (
    <>
      <h1>Tasks</h1>
      <p className="sub">Add anything: college work, house work, chill time. Pin it to a time, or let me find a slot. Higher priority gets the earlier slots.</p>
      <PlanTabs active="/plan" />

      <form action={addItem} className="card stack">
        <ItemFields item={{ start: day === today ? nextSlot : '09:00', day }} today={today} />
        <button className="btn block">Add task</button>
      </form>

      {leftover.length > 0 && (
        <>
          <h2>⏰ Not done yet</h2>
          <div className="stack">
            {leftover.map((t) => (
              <div key={t.key} className="card row">
                <div className="grow"><b>{t.emoji} {t.title}</b><div className="muted small">was at {fmtTime(t.start)}</div></div>
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
        <h2>🗓️ {day === today ? 'Today' : fmtDay(day + 'T12:00:00+05:30')}</h2>
        <div className="row">
          {day > today && <a className="small muted" href={`/plan?day=${addDays(day, -1)}`}>← Prev</a>}
          <a className="small muted" href={`/plan?day=${addDays(day, 1)}`}>Next →</a>
        </div>
      </div>
      <Timeline items={items} day={day} />

      <h2>📋 All your tasks · {all.length}</h2>
      {!all.length && <div className="card empty">Nothing yet. Add your first task above.</div>}
      <div className="stack">
        {all.map((t) => (
          <div key={`${t.kind}${t.id}`} className={`card prio-${t.priority}`}>
            <div className="row">
              <div style={{ fontSize: 22 }}>{t.emoji}</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div className="muted small">{t.meta}</div>
              </div>
              <span className={`pill p-${t.priority}`}>{PRIORITIES[t.priority]?.emoji} {PRIORITIES[t.priority]?.label}</span>
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8, alignItems: 'flex-start' }}>
              <details className="edit grow">
                <summary>Edit</summary>
                <form action={updateItem} className="stack">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="kind" value={t.kind} />
                  <ItemFields item={t.fields} today={today} />
                  <div className="grid2">
                    <button className="btn">Save</button>
                    <button className="btn ghost" formAction={deleteItem}>Delete</button>
                  </div>
                </form>
              </details>
              {t.kind === 'chore' && (
                <>
                  <form action={rescheduleChore} className="inline"><input type="hidden" name="id" value={t.id} /><button className="btn small ghost">Later</button></form>
                  <form action={toggleChore} className="inline"><input type="hidden" name="id" value={t.id} /><button className="icon-btn" aria-label="Done"><Check /></button></form>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {doneFlex.length > 0 && (
        <details>
          <summary>Done ({doneFlex.length})</summary>
          <div className="stack">
            {doneFlex.map((c) => (
              <div key={c.id} className="card row" style={{ opacity: 0.55 }}>
                <div className="grow" style={{ textDecoration: 'line-through' }}>{emojiFor(c)} {c.title}</div>
                <form action={toggleChore} className="inline"><input type="hidden" name="id" value={c.id} /><button className="btn small ghost">Undo</button></form>
                <form action={deleteItem} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="kind" value="chore" /><button className="btn small ghost">Delete</button></form>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
