// Summaries of pre-reads and post-reads, so you can catch up in 5 minutes when there's no time.
import { gemini, MODEL, cleanMarkdown } from './ai';
import { sql } from './db';
import { login, materialUrl } from './lms';

const PROMPT = (r) => `This is a ${r.kind === 'pre' ? 'pre-read (to read BEFORE class)' : 'post-read (to read AFTER class)'}
for the course "${r.course}", titled "${r.title}". Summarise it for a busy MBA-style student in Markdown:

## The 30-second version
3 bullet points: the core message.

## Key ideas
The main concepts or arguments, each as a bold term + 1-2 plain sentences.

## Numbers & examples worth remembering
Specific companies, data, cases or quotes from the reading.

## ${r.kind === 'pre' ? 'Walk into class ready to answer' : 'Connect it back to class'}
3-4 questions the professor is likely to ask, or points to raise in discussion.

Rules: stick to what the document says; never invent. Under 500 words.
Start directly with "## The 30-second version": no preamble, no horizontal rules.`;

async function summarise(r) {
  let parts;
  if (r.file_type === 'pdf') {
    const url = await materialUrl(await login(), r.id);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const data = Buffer.from(await res.arrayBuffer()).toString('base64');
    parts = [{ inlineData: { mimeType: 'application/pdf', data } }, { text: PROMPT(r) }];
  } else {
    parts = [{ text: `${PROMPT(r)}\n\n---\n${r.body}` }];
  }
  const out = await gemini().models.generateContent({ model: MODEL(), contents: [{ role: 'user', parts }] });
  if (!out.text?.trim()) throw new Error('Gemini returned no summary');
  return cleanMarkdown(out.text.trim());
}

/** Summarises the oldest reading that still needs it. Returns the reading or null. */
export async function processNextReading() {
  const [r] = await sql`
    SELECT * FROM readings WHERE summary_status IN ('pending', 'error') AND attempts < 3
    ORDER BY posted_at NULLS LAST LIMIT 1`;
  if (!r) return null;
  await sql`UPDATE readings SET attempts = attempts + 1 WHERE id = ${r.id}`;
  try {
    const md = await summarise(r);
    await sql`UPDATE readings SET summary_md = ${md}, summary_status = 'done', summary_error = NULL WHERE id = ${r.id}`;
    return { ...r, summary_status: 'done' };
  } catch (e) {
    await sql`UPDATE readings SET summary_status = 'error', summary_error = ${String(e.message).slice(0, 500)} WHERE id = ${r.id}`;
    throw e;
  }
}
