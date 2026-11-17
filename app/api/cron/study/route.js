// Builds the study guide for one course session: GET /api/cron/study?course=b2b-sales&session=3
import { NextResponse } from 'next/server';
import { isCron } from '@/lib/auth';
import { buildGuide, STUDY_COURSES } from '@/lib/study';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const course = q.get('course') || 'b2b-sales';
  const session = Number(q.get('session'));
  if (!STUDY_COURSES[course] || !(session >= 1 && session <= STUDY_COURSES[course].sessions)) {
    return NextResponse.json({ error: 'unknown course or session' }, { status: 400 });
  }
  try {
    return NextResponse.json(await buildGuide(course, session));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
