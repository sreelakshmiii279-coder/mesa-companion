import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { latestNews, CATEGORIES } from '@/lib/news';
import { fmtRelative } from '@/lib/time';
import NewsRefresh from '@/components/NewsRefresh';

export const dynamic = 'force-dynamic';

export default async function News({ searchParams }) {
  await requireAuth();
  const cat = (await searchParams).c;
  const news = await latestNews();
  const items = news?.items ?? [];
  const cats = CATEGORIES.filter((c) => items.some((s) => s.category === c));
  const shown = cat ? items.filter((s) => s.category === cat) : items;
  return (
    <>
      <h1>The briefing</h1>
      <p className="sub">
        What's moving markets, business, India and the world, and why it matters to you.
        {news && <> Updated {fmtRelative(news.created_at)}.</>}
      </p>
      <NewsRefresh stale={!news || Date.now() - new Date(news.created_at) > 5 * 3600_000} />
      {cats.length > 1 && (
        <div className="chips">
          <Link href="/news" className={!cat ? 'on' : ''}>All</Link>
          {cats.map((c) => <Link key={c} href={`/news?c=${encodeURIComponent(c)}`} className={c === cat ? 'on' : ''}>{c}</Link>)}
        </div>
      )}
      {!items.length && <div className="card empty">Putting together your first briefing… this takes about 20 seconds.</div>}
      <div className="stack">
        {shown.map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="card story">
            <div className="row between">
              <span className="cat grad-text">{s.category}</span>
              <span className="small muted">{s.source}</span>
            </div>
            <div className="h">{s.headline}</div>
            <div className="muted" style={{ fontSize: 15 }}>{s.summary}</div>
            <div className="why"><b>Why it matters · </b>{s.why}</div>
          </a>
        ))}
      </div>
    </>
  );
}
