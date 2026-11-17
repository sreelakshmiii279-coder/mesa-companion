// Interactive study guides: one per course session, built from the session's deck and pre-read (PDFs from
// Nexus, read directly by Gemini) plus the class recording notes, with check questions throughout.
import { Type } from '@google/genai';
import { gemini, MODEL } from './ai';
import { sql, getMeta } from './db';
import { login, get, materialUrl } from './lms';

// Courses with a study guide. `match` finds the course on Nexus by title.
export const STUDY_COURSES = {
  'b2b-sales': { match: /^B2B Sales/i, name: 'B2B Sales: Signal to Signed', sessions: 6 },
};

const sessionOf = (title) => Number((title.match(/session\s*0?(\d+)/i) || [])[1]) || null;

/** Every deck, pre-read and recording for a course on Nexus, grouped by session number. */
export async function courseSources(slug) {
  const cfg = STUDY_COURSES[slug];
  const token = await login();
  const termId = await getMeta('term2_id');
  const { courses } = await get(token, `/curriculum/courses?termId=${encodeURIComponent(termId)}`);
  const course = courses.find((c) => cfg.match.test(c.title));
  if (!course) throw new Error(`Course not found on Nexus: ${cfg.name}`);
  const { topics } = await get(token, `/curriculum/topics?courseId=${encodeURIComponent(course.id)}`);
  const bySession = {};
  const add = (n, item) => { if (n) (bySession[n] ??= { decks: [], prereads: [], recordings: [] })[item.kind].push(item); };
  for (const t of topics) {
    if (t.type === 'prereads' || t.type === 'resources') {
      const { materials } = await get(token, `/content/topics/${encodeURIComponent(t.id)}/materials`);
      for (const m of materials.filter((m) => m.isPublished && m.kind === 'file' && m.fileType === 'pdf')) {
        add(sessionOf(m.title), { kind: t.type === 'prereads' ? 'prereads' : 'decks', id: m.id, title: m.title, file: m.fileName });
      }
    }
    if (t.type === 'recordings') {
      const { recordings } = await get(token, `/content/topics/${encodeURIComponent(t.id)}/recordings`);
      for (const r of recordings.filter((r) => r.isPublished)) add(sessionOf(r.title), { kind: 'recordings', id: r.id, title: r.title });
    }
  }
  return { course: course.title, token, bySession };
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
          body: { type: Type.STRING, description: 'Markdown, 120-250 words: explain clearly, with the example used in class' },
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

const PROMPT = ({ course, session, notes, have }) => `You are building an interactive study guide for an MBA student at Mesa
School of Business. Course: ${course}. Session ${session}.

Sources attached: ${have.join(', ')}.${notes ? `\n\nClass recording notes for this session:\n${notes}` : ''}

Build the guide for THIS session only, from these sources:
- Teach it in order, in 4-7 sections, like a great tutor: plain language, the frameworks exactly as taught, and the
  companies, numbers and cases the instructor used. Where the deck and the class notes disagree, follow the class notes.
- End every section with ONE check question that tests understanding, not recall of a word.
- Flashcards: the terms and frameworks worth memorising.
- Final quiz: 5-6 scenario questions ("A founder selling X to Y does Z - what should they do next?") in the style an exam
  would use. Make wrong options plausible.
- Exam tips: what is most likely to be tested, and common mistakes.
Never invent content that isn't in the sources. If a source is missing for this session, work from what is there.`;

/** Same question, options in random order, answer index updated to match. */
export function shuffleQuestion(q) {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

async function pdfPart(token, id) {
  const res = await fetch(await materialUrl(token, id));
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return { inlineData: { mimeType: 'application/pdf', data: Buffer.from(await res.arrayBuffer()).toString('base64') } };
}

/** Builds (or rebuilds) the guide for one session and stores it. */
export async function buildGuide(slug, session) {
  const { course, token, bySession } = await courseSources(slug);
  const src = bySession[session];
  if (!src) throw new Error(`Nothing on Nexus for session ${session} yet`);

  const parts = [];
  const have = [];
  for (const d of src.decks) { parts.push(await pdfPart(token, d.id)); have.push(`class deck "${d.title}"`); }
  for (const p of src.prereads) { parts.push(await pdfPart(token, p.id)); have.push(`pre-read "${p.title}"`); }
  const recIds = src.recordings.map((r) => r.id);
  const notes = recIds.length
    ? (await sql`SELECT title, notes_md FROM recordings WHERE id = ANY(${recIds}) AND notes_status = 'done'`)
      .map((r) => `### ${r.title}\n${r.notes_md}`).join('\n\n')
    : '';
  if (notes) have.push('class recording notes (below)');
  if (!parts.length && !notes) throw new Error(`Session ${session}: no deck, pre-read or recording notes yet`);

  parts.push({ text: PROMPT({ course, session, notes, have }) });
  const res = await gemini().models.generateContent({
    model: MODEL(),
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3 },
  });
  const guide = JSON.parse(res.text);
  // Keep only well-formed questions (answer index in range).
  const okQ = (q) => q && Array.isArray(q.options) && q.options.length === 4 && q.answer >= 0 && q.answer < 4;
  // Models put the right answer in the same slot most of the time (B, in testing), so shuffle every question.
  guide.sections = guide.sections.map((s) => ({ ...s, check: okQ(s.check) ? shuffleQuestion(s.check) : null }));
  guide.quiz = guide.quiz.filter(okQ).map(shuffleQuestion);

  const sources = {
    decks: src.decks.map((d) => d.title), prereads: src.prereads.map((p) => p.title),
    recordings: src.recordings.map((r) => r.title), notes_used: Boolean(notes),
  };
  await sql`INSERT INTO study_guides (course, session, guide, sources) VALUES (${slug}, ${session}, ${JSON.stringify(guide)}, ${JSON.stringify(sources)})
            ON CONFLICT (course, session) DO UPDATE SET guide = EXCLUDED.guide, sources = EXCLUDED.sources, updated_at = now()`;
  return { session, title: guide.title, sources };
}

export async function getGuides(slug) {
  return sql`SELECT session, guide, sources, updated_at FROM study_guides WHERE course = ${slug} ORDER BY session`;
}
