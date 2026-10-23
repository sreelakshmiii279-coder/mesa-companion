import { toggleTaskDone } from '@/app/actions';
import { fmtTime, fmtDuration } from '@/lib/time';

const MIN = 60_000;

/** Classes and tasks for one day, with the free time between them. */
export default function Timeline({ items, day, now = new Date() }) {
  if (!items.length) return <div className="card empty">Nothing scheduled. Add a task on the Plan tab.</div>;
  const rows = [];
  let cursor = null;
  for (const it of items) {
    if (cursor && it.start - cursor >= 20 * MIN) {
      rows.push(
        <li key={`gap-${it.key}`}><div className="time" /><div className="gap">Free · {fmtDuration((it.start - cursor) / MIN)}</div></li>,
      );
    }
    const isNow = it.start <= now && now < it.end;
    rows.push(
      <li key={it.key}>
        <div className="time">{fmtTime(it.start)}</div>
        <div className={`item ${it.type}${it.done ? ' done' : ''}${isNow ? ' now' : ''}`}>
          <div className="grow">
            <div className="t">{it.title}</div>
            <div className="d">
              {fmtTime(it.start)}–{fmtTime(it.end)}
              {it.detail ? ` · ${it.detail}` : ''}
              {it.repeat && it.repeat !== 'none' ? ` · ${it.repeat}` : ''}
            </div>
          </div>
          {it.type === 'task' && (
            <form action={toggleTaskDone} className="inline">
              <input type="hidden" name="id" value={it.id} />
              <input type="hidden" name="day" value={day} />
              <button className={`icon-btn${it.done ? ' on' : ''}`} aria-label={it.done ? 'Mark not done' : 'Mark done'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5L20 7" /></svg>
              </button>
            </form>
          )}
        </div>
      </li>,
    );
    if (!cursor || it.end > cursor) cursor = it.end;
  }
  return <ul className="tl">{rows}</ul>;
}
