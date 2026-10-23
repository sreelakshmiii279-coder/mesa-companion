import { toggleAssignment } from '@/app/actions';
import { fmtRelative, fmtDay, fmtTime } from '@/lib/time';

export function urgency(due, now = new Date()) {
  const h = (new Date(due) - now) / 3600_000;
  return h < 24 ? 'urgent' : h < 72 ? 'soon' : '';
}

export default function DueList({ items, showToggle = true }) {
  if (!items.length) return <div className="card empty">Nothing pending. 🎉</div>;
  return (
    <div className="stack">
      {items.map((a) => {
        const done = a.submitted || a.marked_done;
        return (
          <div key={a.id} className="card row" style={done ? { opacity: 0.55 } : undefined}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{a.title}</div>
              <div className="muted small">
                {a.course ?? 'General'} · {a.due_at ? `${fmtDay(a.due_at)}, ${fmtTime(a.due_at)}` : 'no due date'}
                {a.submitted ? ' · submitted' : a.marked_done ? ' · marked done' : ''}
              </div>
            </div>
            {!done && a.due_at && <span className={`pill ${urgency(a.due_at)}`}>{fmtRelative(a.due_at)}</span>}
            {showToggle && !a.submitted && (
              <form action={toggleAssignment} className="inline">
                <input type="hidden" name="id" value={a.id} />
                <button className={`icon-btn${a.marked_done ? ' on' : ''}`} aria-label={a.marked_done ? 'Mark not done' : 'Mark done (stops reminders)'}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5L20 7" /></svg>
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
