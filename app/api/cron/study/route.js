// Study guides.
//   GET /api/cron/study?plan=1                          re-read Nexus and arrange every course into sessions
//   GET /api/cron/study?course=b2b-sales&session=3      build one session's guide (about a minute)
import { NextResponse } from 'next/server';
import { isCron } from '@/lib/auth';
import { buildGuide, planAllCourses } from '@/lib/study';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const q = new URL(req.url).searchParams;
  try {
    if (q.get('plan')) return NextResponse.json(await planAllCourses());
    const course = q.get('course');
    const session = Number(q.get('session'));
    if (!course || !(session >= 1)) return NextResponse.json({ error: 'course and session required' }, { status: 400 });
    return NextResponse.json(await buildGuide(course, session));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
