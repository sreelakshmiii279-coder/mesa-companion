// Interactive study guides for every Term 2 course: one guide per session, built from everything on Nexus for
// that session (PDF decks and pre-reads, Google Slides / Docs exported as PDF, text notes, the course outline)
// plus the class recording notes, with check questions throughout.
import { Type } from '@google/genai';
import { gemini, MODEL } from './ai';
import { sql, getMeta } from './db';
import { login, get, materialUrl } from './lms';

const DAY = 86_400_000;
const INLINE_MAX = 9_000_000;  // larger PDFs go through Gemini's file upload instead of inline
const PDF_MAX = 45_000_000;

// Stable short URLs for courses (the first one existed before this file covered every course).
const SLUG_OVERRIDES = { 'b2b-sales-signal-to-signed': 'b2b-sales' };

export function slugify(title) {
  const clean = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const base = clean(title.split(/ with /i)[0]);
  // Two Operations courses share a base name; keep the teacher in the slug for those.
  const slug = /^operations/.test(base) ? clean(title).split('-').slice(0, 7).join('-') : base;
  return SLUG_OVERRIDES[slug] || slug;
}

/** Numbers a title refers to: "Session 3" -> [3], "Session 1 & 2" -> [1,2], "Session 3-4" -> [3,4], "T2-L6" -> [6]. */
export function sessionNumbers(title) {
  const t = title.replace(/_/g, ' ');
  const m = t.match(/(?:session|lecture|sess)\s*0?(\d{1,2})(?:\s*(?:&|and|-|to)\s*0?(\d{1,2}))?/i)
    || t.match(/\b[SL]0?(\d{1,2})(?:\s*[A-Z]?\s*-\s*[SL]?0?(\d{1,2}))?\b/);
  if (!m) return [];
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
  if (!(a >= 1 && a <= 30)) return [];
  if (b < a || b - a > 3) return [a];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const GDOC = /docs\.google\.com\/(presentation|document)\/d\/([\w-]+)/;

/** How a material can be used: 'pdf' (Nexus file), 'gdoc' (export as PDF), 'text', or 'list' (shown, not read). */
function sourceType(m) {
  if (m.kind === 'file' && m.fileType === 'pdf') return 'pdf';
  if (m.kind === 'link' && GDOC.test(m.url || '')) return 'gdoc';
  if (m.kind === 'text') return 'text';
  return 'list';
}

const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Everything on Nexus for every Term 2 course, arranged into sessions. Saved to study_courses. */
export async function planAllCourses() {
  const token = await login();
  const termId = await getMeta('term2_id');
  const { courses } = await get(token, `/curriculum/courses?termId=${encodeURIComponent(termId)}`);
  const plans = [];
  for (const c of courses) {
    const plan = await planCourse(token, c);
    if (!plan.units.length) continue;
    const slug = slugify(c.title);
    await sql`INSERT INTO study_courses (slug, name, plan) VALUES (${slug}, ${c.title}, ${JSON.stringify(plan)})
              ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, plan = EXCLUDED.plan, updated_at = now()`;
    plans.push({ slug, name: c.title, units: plan.units.map((u) => ({
      n: u.n, label: u.label, recordings: u.recordings.length,
      materials: u.materials.map((m) => `${m.type}:${m.title}`) })) });
  }
  return plans;
}

async function planCourse(token, course) {
  const { topics } = await get(token, `/curriculum/topics?courseId=${encodeURIComponent(course.id)}`);
  const materials = [];
  const recordings = [];
  let outline = '';
  for (const t of topics) {
    if (t.type === 'recordings') {
      const { recordings: recs } = await get(token, `/content/topics/${encodeURIComponent(t.id)}/recordings`);
      recordings.push(...recs.filter((r) => r.isPublished).map((r) => ({ id: r.id, title: r.title, date: r.recordedOn })));
    } else if (!['assignments', 'announcements'].includes(t.type)) {
      const { materials: mats } = await get(token, `/content/topics/${encodeURIComponent(t.id)}/materials`);
      for (const m of mats.filter((m) => m.isPublished)) {
        if (t.type === 'outline') { outline += `${m.title}: ${stripHtml(m.content)}\n`; continue; }
        materials.push({
          id: m.id, title: m.title, topic: t.title, type: sourceType(m), date: (m.createdAt || '').slice(0, 10),
          url: m.kind === 'link' ? m.url : null, file: m.fileName || null, size: m.sizeBytes || 0,
          text: m.kind === 'text' ? stripHtml(m.content).slice(0, 4000) : null,
        });
      }
    }
  }

  // Sessions come from the recordings (one per class), numbered by their title or, failing that, by date.
  recordings.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const units = new Map();
  const unit = (n) => {
    if (!units.has(n)) units.set(n, { n, label: '', date: null, recordings: [], materials: [] });
    return units.get(n);
  };
  let next = 1;
  for (const r of recordings) {
    const nums = sessionNumbers(r.title);
    const n = nums[0] || next;
    next = Math.max(next, n + 1);
    const u = unit(n);
    u.recordings.push(r);
    u.date ??= r.date;
    if (!nums.length && !u.label) u.label = r.title;  // e.g. "Achal Bassambo - Little's Law"
  }

  // Materials, in order of trust:
  //  1. the session number in their title ("Session 3", "L4", "Session 3-4"), unless that class was more than
  //     10 days before the material went up (e.g. an "Advanced AI S1" deck belongs to the class it was posted for);
  //  2. a topic word shared with exactly one named session ("Revenue ... primer" -> "Primer - Revenue");
  //  3. the first class on or after the upload date (pre-reads and decks go up before class);
  //  4. anything after the last class becomes a "Further material" session.
  const dated = [...units.values()].filter((u) => u.date).sort((a, b) => a.date.localeCompare(b.date));
  const named = [...units.values()].filter((u) => u.label);
  const STOP = new Set(['session', 'specialization', 'specialisation', 'primer', 'deck', 'with', 'and', 'the', 'for', 'part', 'notes']);
  const words = (x) => new Set(x.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)));
  let extra = null;
  for (const m of materials) {
    const t = m.date ? new Date(m.date).getTime() : null;
    const nums = (sessionNumbers(m.title).length ? sessionNumbers(m.title) : sessionNumbers(m.file || '')).filter((n) => {
      const d = units.get(n)?.date;
      return !(d && t != null && t - new Date(d).getTime() > 10 * DAY);
    });
    if (nums.length) { nums.forEach((n) => unit(n).materials.push(m)); continue; }
    const mw = words(m.title);
    const hits = named.filter((u) => [...words(u.label)].some((w) => mw.has(w)));
    if (hits.length === 1) { hits[0].materials.push(m); continue; }
    const target = t != null ? dated.find((u) => u.date >= m.date) : dated.at(-1);
    if (target) { target.materials.push(m); continue; }
    if (!extra) {
      extra = unit(Math.max(0, ...units.keys()) + 1);
      extra.label = 'Further material';
    }
    extra.materials.push(m);
  }

  const list = [...units.values()].sort((a, b) => a.n - b.n)
    .filter((u) => u.recordings.length || u.materials.some((m) => m.type !== 'list'));
  return { outline: outline.slice(0, 3000), units: list };
}

const MCQ = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING },
    options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 4, maxItems: 4 },
    answer: { type: Type.INTEGER, description: '0-based index of the correct option' },
    explanation: { type: Type.STRING, description: 'why the answer is right and the most tempting wrong one is wrong; refer to options by what they say, never by number or letter' },
  },
  required: ['question', 'options', 'answer', 'explanation'],
};

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "this session's topic in max 7 words, e.g. 'Diagnose before you pitch'; never the course name" },
    one_line: { type: Type.STRING },
    goals: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-5 "you will be able to..." goals' },
    sections: {
      type: Type.ARRAY, minItems: 4, maxItems: 7,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          body: { type: Type.STRING, description: 'Markdown, 120-250 words: explain clearly, with the example used in class. Code in fenced blocks where relevant.' },
          key_terms: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
            term: { type: Type.STRING }, meaning: { type: Type.STRING } }, required: ['term', 'meaning'] } },
          check: MCQ,
        },
        required: ['heading', 'body', 'key_terms', 'check'],
      },
    },
    frameworks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      name: { type: Type.STRING }, steps: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['name', 'steps'] } },
    examples: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      name: { type: Type.STRING }, lesson: { type: Type.STRING } }, required: ['name', 'lesson'] } },
    flashcards: { type: Type.ARRAY, minItems: 6, maxItems: 10, items: { type: Type.OBJECT, properties: {
      front: { type: Type.STRING }, back: { type: Type.STRING } }, required: ['front', 'back'] } },
    quiz: { type: Type.ARRAY, minItems: 5, maxItems: 6, items: MCQ, description: 'scenario-based, exam style' },
    exam_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['title', 'one_line', 'goals', 'sections', 'frameworks', 'examples', 'flashcards', 'quiz', 'exam_tips'],
};

const PROMPT = ({ course, unit, outline, notes, have, listed }) => `You are building an interactive study guide for an MBA student at
Mesa School of Business. Course: ${course}. Session ${unit.n}${unit.label ? ` (${unit.label})` : ''}.

Sources attached: ${have.join('; ')}.${outline ? `\n\nCourse outline (context only):\n${outline}` : ''}${listed.length ? `\n\nAlso on Nexus for this session but not attached (data files, forms, quizzes): ${listed.join(', ')}.` : ''}${notes ? `\n\nClass recording notes for this session:\n${notes}` : ''}

Build the guide for THIS session only, from these sources:
- Teach it in order, in 4-7 sections, like a great tutor: plain language, the frameworks exactly as taught, and the
  companies, numbers, cases and code the instructor used. Where slides and the class notes disagree, follow the class notes.
- End every section with ONE check question that tests understanding, not recall of a word.
- Flashcards: the terms, formulas and frameworks worth memorising.
- Final quiz: 5-6 scenario questions ("A founder selling X to Y does Z - what should they do next?") in the style an exam
  would use. For technical courses (SQL, data, AI), ask what a query, metric or design would produce or what is wrong with it.
  Make wrong options plausible.
- Exam tips: what is most likely to be tested, and common mistakes.
Never invent content that isn't in the sources. If a source type is missing for this session, work from what is there.`;

/** Same question, options in random order, answer index updated to match. */
export function shuffleQuestion(q) {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

async function fetchPdf(token, m) {
  let url;
  if (m.type === 'pdf') url = await materialUrl(token, m.id);
  else {
    const [, kind, id] = m.url.match(GDOC);
    url = kind === 'presentation' ? `https://docs.google.com/presentation/d/${id}/export/pdf`
      : `https://docs.google.com/document/d/${id}/export?format=pdf`;
  }
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 4).toString() !== '%PDF') throw new Error('not shared publicly (no PDF came back)');
  if (buf.length > PDF_MAX) throw new Error(`too large (${Math.round(buf.length / 1e6)} MB)`);
  if (buf.length <= INLINE_MAX) return { inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } };
  const file = await gemini().files.upload({ file: new Blob([buf], { type: 'application/pdf' }), config: { mimeType: 'application/pdf' } });
  return { fileData: { fileUri: file.uri, mimeType: 'application/pdf' } };
}

async function loadPlan(slug) {
  const [row] = await sql`SELECT name, plan FROM study_courses WHERE slug = ${slug}`;
  return row;
}

/** Builds (or rebuilds) the guide for one session of one course and stores it. */
export async function buildGuide(slug, n) {
  const course = await loadPlan(slug);
  if (!course) throw new Error(`No plan for ${slug}; run the planner first`);
  const unit = course.plan.units.find((u) => u.n === n);
  if (!unit) throw new Error(`${course.name}: nothing for session ${n}`);
  const token = await login();

  const parts = [];
  const have = [];
  const skipped = [];
  const listed = [];
  for (const m of unit.materials) {
    if (m.type === 'pdf' || m.type === 'gdoc') {
      try {
        parts.push(await fetchPdf(token, m));
        have.push(`"${m.title}" (${m.topic}${m.type === 'gdoc' ? ', Google ' + (m.url.includes('presentation') ? 'Slides' : 'Doc') : ''})`);
      } catch (e) {
        skipped.push(`${m.title}: ${e.message}`);
      }
    } else if (m.type === 'text' && m.text) {
      parts.push({ text: `Nexus note "${m.title}":\n${m.text}` });
      have.push(`note "${m.title}"`);
    } else {
      listed.push(m.title);
    }
  }
  const recIds = unit.recordings.map((r) => r.id);
  const notes = recIds.length
    ? (await sql`SELECT title, notes_md FROM recordings WHERE id = ANY(${recIds}) AND notes_status = 'done'`)
      .map((r) => `### ${r.title}\n${r.notes_md}`).join('\n\n')
    : '';
  if (notes) have.push('class recording notes (below)');
  if (!parts.length && !notes) throw new Error(`${course.name} session ${n}: no readable material or recording notes yet`);

  parts.push({ text: PROMPT({ course: course.name, unit, outline: course.plan.outline, notes, have, listed }) });
  const res = await gemini().models.generateContent({
    model: MODEL(),
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3 },
  });
  const guide = JSON.parse(res.text);
  const okQ = (q) => q && Array.isArray(q.options) && q.options.length === 4 && q.answer >= 0 && q.answer < 4;
  // Models put the right answer in the same slot most of the time (B, in testing), so shuffle every question.
  guide.sections = guide.sections.map((s) => ({ ...s, check: okQ(s.check) ? shuffleQuestion(s.check) : null }));
  guide.quiz = guide.quiz.filter(okQ).map(shuffleQuestion);

  const sources = {
    label: unit.label || null,
    used: have,
    materials: unit.materials.map((m) => ({ title: m.title, topic: m.topic, type: m.type, url: m.url })),
    recordings: unit.recordings.map((r) => r.title),
    notes_used: Boolean(notes),
    skipped,
  };
  await sql`INSERT INTO study_guides (course, session, guide, sources) VALUES (${slug}, ${n}, ${JSON.stringify(guide)}, ${JSON.stringify(sources)})
            ON CONFLICT (course, session) DO UPDATE SET guide = EXCLUDED.guide, sources = EXCLUDED.sources, updated_at = now()`;
  return { course: slug, session: n, title: guide.title, used: have.length, skipped };
}

/** Rebuild the guide for whichever session a newly processed recording or reading belongs to. */
export async function refreshForItem(courseTitle, itemId) {
  const slug = slugify(courseTitle);
  const course = await loadPlan(slug);
  if (!course) return null;
  const unit = course.plan.units.find((u) => u.recordings.some((r) => r.id === itemId) || u.materials.some((m) => m.id === itemId));
  if (!unit) return null;
  await buildGuide(slug, unit.n);
  return { slug, name: course.name, session: unit.n };
}

export async function getCourses() {
  return sql`SELECT c.slug, c.name, c.plan, count(g.session)::int AS built, max(g.updated_at) AS updated_at
             FROM study_courses c LEFT JOIN study_guides g ON g.course = c.slug
             GROUP BY c.slug, c.name, c.plan ORDER BY c.name`;
}

export async function getCourse(slug) {
  const [course] = await sql`SELECT slug, name, plan FROM study_courses WHERE slug = ${slug}`;
  if (!course) return null;
  const guides = await sql`SELECT session, guide, sources FROM study_guides WHERE course = ${slug} ORDER BY session`;
  return { ...course, guides };
}
