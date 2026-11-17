// Public (no login) interactive study guide for one course, built for desktop.
import { notFound } from 'next/navigation';
import { getCourse } from '@/lib/study';
import StudyGuide from '@/components/StudyGuide';

export const dynamic = 'force-dynamic';

const short = (name) => name.split(' with ')[0];

export async function generateMetadata({ params }) {
  const c = await getCourse((await params).course);
  return { title: c ? `${short(c.name)} · Study guide` : 'Study guide' };
}

export default async function Study({ params }) {
  const { course } = await params;
  const c = await getCourse(course);
  if (!c) notFound();
  const units = c.plan.units.map((u) => ({ n: u.n, label: u.label || '' }));
  const guides = c.guides.map((g) => ({ session: g.session, guide: g.guide, sources: g.sources }));
  return <StudyGuide slug={course} courseName={short(c.name)} units={units} guides={guides} />;
}
