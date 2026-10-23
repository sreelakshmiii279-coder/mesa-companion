// News briefing: pull headlines from Google News (India + global), let Gemini pick what actually matters.
import { Type } from '@google/genai';
import { generateJson } from './ai';
import { sql } from './db';

const G = 'https://news.google.com/rss';
const IN = 'hl=en-IN&gl=IN&ceid=IN:en';
const FEEDS = [
  `${G}?${IN}`,
  `${G}/headlines/section/topic/NATION?${IN}`,
  `${G}/headlines/section/topic/BUSINESS?${IN}`,
  `${G}/headlines/section/topic/WORLD?${IN}`,
  `${G}/headlines/section/topic/TECHNOLOGY?${IN}`,
  `${G}/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en`,
];

export const CATEGORIES = ['World', 'Markets', 'Business', 'India', 'Policy & Law', 'Tech & AI', 'Startups'];

const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" })[m]);
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '').trim();

async function headlines() {
  const seen = new Set();
  const out = [];
  const feeds = await Promise.allSettled(FEEDS.map((u) => fetch(u, { cache: 'no-store' }).then((r) => r.text())));
  for (const f of feeds) {
    if (f.status !== 'fulfilled') continue;
    for (const [, item] of f.value.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const source = tag(item, 'source');
      const title = tag(item, 'title').replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
      const key = title.toLowerCase().slice(0, 60);
      if (!title || seen.has(key)) continue;
      seen.add(key);
      out.push({ title, source, link: tag(item, 'link'), published: tag(item, 'pubDate') });
    }
  }
  return out.slice(0, 160);
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    stories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER, description: 'index of the headline it is based on' },
          category: { type: Type.STRING, enum: CATEGORIES },
          headline: { type: Type.STRING, description: 'clear, neutral headline, max 12 words' },
          summary: { type: Type.STRING, description: '2 sentences: what happened' },
          why: { type: Type.STRING, description: '1 sentence: why it matters for markets, business or India' },
        },
        required: ['index', 'category', 'headline', 'summary', 'why'],
      },
    },
  },
  required: ['stories'],
};

export async function buildBriefing() {
  const list = await headlines();
  if (list.length < 10) throw new Error(`Only ${list.length} headlines fetched`);
  const prompt = `You are the editor of a daily briefing for an MBA student in India who wants to build a business
and stay sharp on what is happening in the world. From the headlines below, pick the 10 most important stories.

Important means: it moves markets or the economy; major business or startup news (deals, results, funding,
leadership changes); geopolitics and wars and how they affect trade, oil, markets or India; new laws, bills,
policies, court rulings, RBI/SEBI/government decisions in India; big tech and AI developments.
Cover a mix: at least 3 India stories and at least 3 global stories.
Skip: local crime, accidents, celebrity, gossip, sports, horoscopes, opinion pieces, and anything sensational
without real consequences. Merge duplicates. Be factual and neutral; don't add facts that aren't in the headline.

Headlines (index | source | title):
${list.map((h, i) => `${i} | ${h.source} | ${h.title}`).join('\n')}`;
  const { stories } = await generateJson(prompt, SCHEMA);
  return stories
    .filter((s) => list[s.index])
    .map((s) => ({ ...s, source: list[s.index].source, url: list[s.index].link, published: list[s.index].published }));
}

export async function latestNews() {
  const [row] = await sql`SELECT * FROM news ORDER BY id DESC LIMIT 1`;
  return row ?? null;
}

/** Makes a fresh briefing if the latest is older than `hours`. Returns the latest briefing. */
export async function refreshNews(hours = 5) {
  const latest = await latestNews();
  if (latest && Date.now() - new Date(latest.created_at) < hours * 3600_000) return latest;
  // Claim the refresh so parallel calls don't all hit Gemini.
  const [claim] = await sql`
    INSERT INTO meta (key, value) VALUES ('news_lock', ${String(Date.now())})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      WHERE meta.value::bigint < ${Date.now() - 120_000}
    RETURNING value`;
  if (!claim) return latest;
  const items = await buildBriefing();
  const [row] = await sql`INSERT INTO news (items) VALUES (${JSON.stringify(items)}) RETURNING *`;
  await sql`DELETE FROM news WHERE id < ${row.id - 30}`;
  return row;
}
