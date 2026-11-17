// Public (no login) interactive study guide, built for desktop.
import { notFound } from 'next/navigation';
import { STUDY_COURSES, getGuides } from '@/lib/study';
import StudyGuide from '@/components/StudyGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const cfg = STUDY_COURSES[(await params).course];
  return { title: cfg ? `${cfg.name} · Study guide` : 'Study guide' };
}

export default async function Study({ params }) {
  const { course } = await params;
  const cfg = STUDY_COURSES[course];
  if (!cfg) notFound();
  const rows = await getGuides(course);
  const guides = rows.map((r) => ({ session: r.session, guide: r.guide, sources: r.sources }));
  return <StudyGuide slug={course} courseName={cfg.name} totalSessions={cfg.sessions} guides={guides} />;
}
