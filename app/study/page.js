// Public (no login): every course with a study guide.
import Link from 'next/link';
import { getCourses } from '@/lib/study';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Study guides · Term 2' };

const short = (name) => name.split(' with ')[0];
const teacher = (name) => name.split(' with ')[1] || '';

export default async function StudyIndex() {
  const courses = await getCourses();
  return (
    <div className="study-index">
      <h1>Term 2 study guides</h1>
      <p className="sub">Every session, built from the decks, pre-reads, resources and class recordings on Nexus, with questions throughout.</p>
      <a href="/study/practice" className="card row" style={{ textDecoration: 'none', marginTop: 14 }}>
        <span style={{ fontSize: 26 }}>🗺️</span>
        <div className="grow"><b>Components map practice</b><div className="muted small">Five cases, a swimlane grid to fill, instant checks and a model answer for each.</div></div>
        <span className="muted">→</span>
      </a>
      <div className="course-grid">
        {courses.map((c) => {
          const total = c.plan.units.length;
          return (
            <Link key={c.slug} href={`/study/${c.slug}`} className="card course-card">
              <div className="cc-name">{short(c.name)}</div>
              {teacher(c.name) && <div className="muted small">with {teacher(c.name)}</div>}
              <div className="cc-meta">
                <span>{c.built} of {total} session{total === 1 ? '' : 's'} ready</span>
                <span className="ss-bar"><i style={{ width: `${total ? (c.built / total) * 100 : 0}%` }} /></span>
              </div>
            </Link>
          );
        })}
      </div>
      {!courses.length && <div className="card empty">Guides are being built. Check back in a few minutes.</div>}
    </div>
  );
}
