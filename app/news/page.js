import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { latestNews, CATEGORIES } from '@/lib/news';
import { fmtRelative } from '@/lib/time';
import NewsRefresh from '@/components/NewsRefresh';

export const dynamic = 'force-dynamic';

const C = (a, b) => ({ '--cat': `linear-gradient(90deg, ${a}, ${b})`, '--catc': a });
const CAT_STYLE = {
  World: C('#3b82f6', '#06b6d4'), Markets: C('#10b981', '#a3e635'), Business: C('#f59e0b', '#fbbf24'),
  India: C('#f97316', '#22c55e'), 'Policy & Law': C('#8b5cf6', '#6366f1'), 'Tech & AI': C('#06b6d4', '#3b82f6'),
  Startups: C('#ec4899', '#f97316'),
};
const CAT_EMOJI = {
  World: '🌍', Markets: '📈', Business: '💼', India: '🇮🇳', 'Policy & Law': '⚖️', 'Tech & AI': '🤖', Startups: '🚀',
};

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
          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="card story" style={CAT_STYLE[s.category]}>
            <div className="row between">
              <span className="cat">{CAT_EMOJI[s.category]} {s.category}</span>
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
