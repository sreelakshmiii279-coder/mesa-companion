// Gemini watches a class recording (straight from its YouTube link) and writes study notes.
import { GoogleGenAI, MediaResolution } from '@google/genai';
import { sql } from './db';

const PROMPT = `You are making study notes for an MBA-style student from this class recording.
Watch the whole recording. Write the notes in Markdown, in this order:

## In one line
One sentence: what this class was about.

## Key ideas
The main concepts, each as a bold term followed by a 1-2 sentence explanation in plain words.

## Frameworks & models
Any framework, formula, checklist or step-by-step method taught. Reproduce its steps or parts exactly.

## Examples & case studies
Companies, stories and numbers the instructor used, and the point each one made.

## What the instructor stressed
Things repeated, flagged as important, "remember this", or likely to come up in an exam or assignment.

## Questions to test yourself
5 short questions (no answers) that check understanding of this class.

## Action items
Readings, assignments, deadlines or prep mentioned for next class. Write "None mentioned" if there were none.

Rules: be specific to what was actually said; never invent content. Skip small talk, attendance and tech issues.
Start directly with "## In one line": no preamble, no title, no horizontal rules.
If a section has nothing, write "None in this class". Keep it tight: aim for 600-1000 words.`;

/** youtube.com/live/ID, youtu.be/ID, watch?v=ID -> https://www.youtube.com/watch?v=ID */
export function watchUrl(url) {
  const m = url.match(/(?:live\/|youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : url;
}

export async function generateNotes(rec) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { fileData: { fileUri: watchUrl(rec.video_url), mimeType: 'video/*' } },
        { text: `Course: ${rec.course}\nClass: ${rec.title} (recorded ${rec.recorded_on ?? 'unknown date'})\n\n${PROMPT}` },
      ],
    }],
    config: { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW },
  });
  let text = res.text?.trim();
  if (!text) throw new Error('Gemini returned no notes');
  // Drop any chatty lead-in before the first heading, and stray horizontal rules.
  const first = text.indexOf('## ');
  if (first > 0) text = text.slice(first);
  return text.replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, '').trim();
}

/** Writes notes for the oldest recording that still needs them. Returns the recording or null. */
export async function processNextRecording() {
  const [rec] = await sql`
    SELECT * FROM recordings WHERE notes_status <> 'done' AND attempts < 3
    ORDER BY recorded_on NULLS LAST, title LIMIT 1`;
  if (!rec) return null;
  await sql`UPDATE recordings SET attempts = attempts + 1 WHERE id = ${rec.id}`;
  try {
    const md = await generateNotes(rec);
    await sql`UPDATE recordings SET notes_md = ${md}, notes_status = 'done', notes_error = NULL,
              updated_at = now() WHERE id = ${rec.id}`;
    return { ...rec, notes_status: 'done' };
  } catch (e) {
    await sql`UPDATE recordings SET notes_status = 'error', notes_error = ${String(e.message).slice(0, 500)},
              updated_at = now() WHERE id = ${rec.id}`;
    throw e;
  }
}
