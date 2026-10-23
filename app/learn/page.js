import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const shortCourse = (c) => c.split(' with ')[0];
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '';

export default async function Learn({ searchParams }) {
  await requireAuth();
  const tab = (await searchParams).tab === 'notes' ? 'notes' : 'reads';
  const [readings, recs] = await Promise.all([
    sql`SELECT id, course, kind, title, file_type, summary_status, is_read, posted_at FROM readings ORDER BY is_read, posted_at DESC NULLS LAST`,
    sql`SELECT id, course, title, thumbnail, recorded_on, notes_status FROM recordings ORDER BY course, recorded_on DESC NULLS LAST, title DESC`,
  ]);
  const byCourse = Object.groupBy(recs, (r) => r.course);
  const unread = readings.filter((r) => !r.is_read).length;

  return (
    <>
      <h1>Learn</h1>
      <p className="sub">Pre-reads, post-reads and class notes for Term 2, each with a summary for when you're short on time.</p>
      <div className="seg">
        <Link href="/learn" className={tab === 'reads' ? 'on' : ''}>Readings{unread ? ` · ${unread}` : ''}</Link>
        <Link href="/learn?tab=notes" className={tab === 'notes' ? 'on' : ''}>Class notes</Link>
      </div>

      {tab === 'reads' && (
        <div className="stack">
          {!readings.length && <div className="card empty">No pre-reads yet.</div>}
          {readings.map((r) => (
            <Link key={r.id} href={`/learn/reading/${r.id}`} className={`card list-link${r.is_read ? '' : ' unread'}`} style={r.is_read ? { opacity: 0.6 } : undefined}>
              <div className="doc-icon">{r.file_type ?? 'doc'}</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div className="muted small">
                  {r.kind === 'pre' ? 'Pre-read' : 'Post-read'} · {shortCourse(r.course)} · {fmtDate(r.posted_at)}
                  {r.summary_status === 'done' ? ' · summary ✓' : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {tab === 'notes' && Object.entries(byCourse).map(([course, list]) => (
        <section key={course}>
          <div className="course-head">{course}</div>
          <div className="stack">
            {list.map((r) => (
              <Link key={r.id} href={`/notes/${r.id}`} className="card list-link">
                {r.thumbnail && <img src={r.thumbnail} alt="" loading="lazy" />}
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{r.title}</div>
                  <div className="muted small">
                    {fmtDate(r.recorded_on)} · {r.notes_status === 'done' ? 'Notes ready' : r.notes_status === 'error' ? 'Retrying soon' : 'Notes coming'}
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
