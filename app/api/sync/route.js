import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { syncPortal } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await syncPortal({ force: true }));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
