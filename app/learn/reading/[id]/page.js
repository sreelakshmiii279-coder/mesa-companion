import Link from 'next/link';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { toggleReadingRead } from '@/app/actions';

export const dynamic = 'force-dynamic';

const renderer = new marked.Renderer();
renderer.html = () => '';

export default async function Reading({ params }) {
  await requireAuth();
  const { id } = await params;
  const [r] = await sql`SELECT * FROM readings WHERE id = ${id}`;
  if (!r) notFound();
  const canOpen = r.file_name || r.link_url;
  return (
    <>
      <Link href="/learn" className="small muted">← Learn</Link>
      <p className="sub" style={{ margin: '14px 0 0' }}>{r.kind === 'pre' ? 'Pre-read' : 'Post-read'} · {r.course}</p>
      <h1>{r.title}</h1>
      <div className="row" style={{ margin: '12px 0 18px', flexWrap: 'wrap' }}>
        {canOpen && <a className="btn" href={`/api/readings/${r.id}/open`} target="_blank" rel="noreferrer">Open {r.file_type ? r.file_type.toUpperCase() : 'link'} ↗</a>}
        <form action={toggleReadingRead} className="inline">
          <input type="hidden" name="id" value={r.id} />
          <button className="btn ghost">{r.is_read ? '✓ Read' : 'Mark as read'}</button>
        </form>
      </div>
      {r.summary_status === 'done' && <article className="card md" dangerouslySetInnerHTML={{ __html: marked.parse(r.summary_md, { renderer }) }} />}
      {r.summary_status === 'pending' && <div className="card empty">Summary is being written. Check back in a few minutes.</div>}
      {r.summary_status === 'error' && <div className="card empty">Summary failed ({r.summary_error}). It will retry.</div>}
      {r.summary_status === 'skip' && (r.body
        ? <article className="card md"><p>{r.body}</p></article>
        : <div className="card empty">This one can't be summarised (it's a {r.file_type ?? 'link'}). Open it above.</div>)}
    </>
  );
}
