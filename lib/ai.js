import { GoogleGenAI } from '@google/genai';

let client;
export function gemini() {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash';

/** Gemini sometimes adds a chatty lead-in or horizontal rules; keep only the Markdown from the first heading. */
export function cleanMarkdown(text) {
  const first = text.indexOf('## ');
  if (first > 0) text = text.slice(first);
  return text.replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, '').trim();
}

/** Asks for JSON matching `schema` and parses it. */
export async function generateJson(prompt, schema, extra = {}) {
  const res = await gemini().models.generateContent({
    model: MODEL(),
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: schema, ...extra },
  });
  return JSON.parse(res.text);
}
