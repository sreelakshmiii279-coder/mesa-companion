import Link from 'next/link';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { watchUrl } from '@/lib/notes';

export const dynamic = 'force-dynamic';

// Notes come from Gemini, not users; still, drop any raw HTML it might emit.
const renderer = new marked.Renderer();
renderer.html = () => '';

export default async function NoteDetail({ params }) {
  await requireAuth();
  const { id } = await params;
  const [rec] = await sql`SELECT * FROM recordings WHERE id = ${id}`;
  if (!rec) notFound();
  return (
    <>
      <Link href="/notes" className="small muted">← All notes</Link>
      <p className="sub" style={{ margin: '12px 0 0' }}>{rec.course}</p>
      <h1>{rec.title}</h1>
      <p className="sub">
        {rec.recorded_on && new Date(rec.recorded_on).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
        {' · '}<a href={watchUrl(rec.video_url)} target="_blank" rel="noreferrer">Watch recording ↗</a>
      </p>
      {rec.notes_status === 'done'
        ? <article className="card notes" dangerouslySetInnerHTML={{ __html: marked.parse(rec.notes_md, { renderer }) }} />
        : <div className="card empty">{rec.notes_status === 'error' ? `Notes failed (${rec.notes_error}). It will retry automatically.` : 'Notes are being written. Check back in a few minutes.'}</div>}
    </>
  );
}
