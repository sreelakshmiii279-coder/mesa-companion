import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { istDay, fmtTime, fmtDay } from '@/lib/time';
import { choreEmoji } from '@/lib/chores';
import { addChore, updateChore, toggleChore, rescheduleChore, deleteChore } from '@/app/actions';
import PlanTabs from '@/components/PlanTabs';

export const dynamic = 'force-dynamic';

const LENGTHS = [10, 15, 20, 30, 45, 60, 90];

/** Fields shared by the "add chore" and "edit chore" forms. */
function ChoreFields({ chore = {} }) {
  const lengths = [...new Set([...LENGTHS, chore.est_min ?? 20])].sort((a, b) => a - b);
  return (
    <>
      <label className="field">What needs doing
        <input name="title" required maxLength={120} defaultValue={chore.title} placeholder="Laundry, groceries, pay electricity bill…" />
      </label>
      <div className="grid2">
        <label className="field">Takes about
          <select name="est_min" defaultValue={String(chore.est_min ?? 20)}>
            {lengths.map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${+(m / 60).toFixed(1)} hr${m > 60 ? 's' : ''}`}</option>)}
          </select>
        </label>
        <label className="field">Done by (optional)
          <input type="date" name="due_day" defaultValue={chore.due_day ?? ''} min={istDay()} />
        </label>
      </div>
    </>
  );
}

function when(slot) {
  if (!slot) return 'finding a slot…';
  const today = istDay();
  const d = istDay(slot);
  const label = d === today ? 'Today' : fmtDay(slot);
  return `${label}, ${fmtTime(slot)}`;
}

export default async function Chores() {
  await requireAuth();
  const [open, done] = await Promise.all([
    sql`SELECT *, due_day::text AS due_day FROM chores WHERE NOT done ORDER BY slot_start NULLS LAST`,
    sql`SELECT * FROM chores WHERE done ORDER BY created_at DESC LIMIT 20`,
  ]);
  return (
    <>
      <h1>Chores</h1>
      <p className="sub">Dump them here. I'll find a free gap around your classes and plans, and nudge you when it's time.</p>
      <PlanTabs active="/chores" />

      <form action={addChore} className="card stack">
        <ChoreFields />
        <button className="btn block">Find me a slot ✨</button>
      </form>

      <h2>🏠 Up next · {open.length}</h2>
      {!open.length && <div className="card empty">Nothing pending. Look at you. 🫶</div>}
      <div className="stack">
        {open.map((c) => (
          <div key={c.id} className="card">
            <div className="row">
              <div style={{ fontSize: 24 }}>{choreEmoji(c.title)}</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <div className="muted small">
                  {when(c.slot_start)} · {c.est_min} min{c.due_day ? ` · by ${fmtDay(c.due_day + 'T12:00:00+05:30')}` : ''}
                  {c.moves > 0 ? ` · moved ${c.moves}×` : ''}
                </div>
              </div>
              <form action={rescheduleChore} className="inline">
                <input type="hidden" name="id" value={c.id} />
                <button className="btn small ghost" title="Find a later slot">Later</button>
              </form>
              <form action={toggleChore} className="inline">
                <input type="hidden" name="id" value={c.id} />
                <button className="icon-btn" aria-label="Done">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"><path d="m5 12 5 5L20 7" /></svg>
                </button>
              </form>
            </div>
            <details className="edit">
              <summary>Edit</summary>
              <form action={updateChore} className="stack">
                <input type="hidden" name="id" value={c.id} />
                <ChoreFields chore={c} />
                <div className="grid2">
                  <button className="btn">Save</button>
                  <button className="btn ghost" formAction={deleteChore}>Delete</button>
                </div>
              </form>
            </details>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <details>
          <summary>Done ({done.length})</summary>
          <div className="stack">
            {done.map((c) => (
              <div key={c.id} className="card row" style={{ opacity: 0.55 }}>
                <div className="grow" style={{ textDecoration: 'line-through' }}>{choreEmoji(c.title)} {c.title}</div>
                <form action={toggleChore} className="inline"><input type="hidden" name="id" value={c.id} /><button className="btn small ghost">Undo</button></form>
                <form action={deleteChore} className="inline"><input type="hidden" name="id" value={c.id} /><button className="btn small ghost">Delete</button></form>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
