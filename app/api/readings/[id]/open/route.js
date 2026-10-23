// Opens a reading: portal files get a fresh signed download link (they expire), links go straight through.
import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { sql } from '@/lib/db';
import { login, materialUrl } from '@/lib/lms';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  if (!(await isAuthed())) return NextResponse.redirect(new URL('/login', req.url));
  const { id } = await params;
  const [r] = await sql`SELECT * FROM readings WHERE id = ${id}`;
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (r.file_name) return NextResponse.redirect(await materialUrl(await login(), r.id));
  if (r.link_url) return NextResponse.redirect(r.link_url);
  return NextResponse.redirect(new URL(`/learn/reading/${id}`, req.url));
}
