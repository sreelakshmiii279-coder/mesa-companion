import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Notes() {
  await requireAuth();
  const recs = await sql`SELECT id, course, title, thumbnail, recorded_on, notes_status
                         FROM recordings ORDER BY course, recorded_on DESC NULLS LAST, title DESC`;
  const byCourse = Object.groupBy(recs, (r) => r.course);
  const ready = recs.filter((r) => r.notes_status === 'done').length;
  return (
    <>
      <h1>Class notes</h1>
      <p className="sub">Term 2 recordings, turned into notes by Gemini. {ready} of {recs.length} ready. New recordings are picked up automatically.</p>
      {!recs.length && <div className="card empty">No recordings yet.</div>}
      {Object.entries(byCourse).map(([course, list]) => (
        <section key={course}>
          <div className="course-head">{course}</div>
          <div className="stack">
            {list.map((r) => (
              <Link key={r.id} href={`/notes/${r.id}`} className="card list-link">
                {r.thumbnail && <img src={r.thumbnail} alt="" loading="lazy" />}
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{r.title}</div>
                  <div className="muted small">
                    {r.recorded_on ? new Date(r.recorded_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                    {' · '}{r.notes_status === 'done' ? 'Notes ready' : r.notes_status === 'error' ? 'Notes failed, retrying' : 'Notes coming'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
