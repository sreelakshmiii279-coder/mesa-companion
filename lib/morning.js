// A fresh morning message each day, written from the user's goals and today's schedule.
import { Type } from '@google/genai';
import { generateJson } from './ai';
import { getMeta, setMeta } from './db';
import { timeline, pendingAssignments } from './planner';
import { istDay, fmtTime, fmtRelative } from './time';

// What the user told us they're working towards.
const GOALS = [
  'Become super smart: learn something every day and stay on top of the news',
  'Show up prepared: pre-reads done, deadlines early',
  'Build their own business; they see themselves as already on the way',
];

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    affirmation: { type: Type.STRING, description: 'first person, present tense, max 14 words' },
    futureSelf: { type: Type.STRING, description: '2-3 sentences written by their future self to them today' },
    focus: { type: Type.STRING, description: 'one sentence: the single most important thing to win today' },
  },
  required: ['affirmation', 'futureSelf', 'focus'],
};

/** Today's morning message (generated once per IST day, then cached). */
export async function dailyMotivation(day = istDay()) {
  const cached = await getMeta(`morning:${day}`);
  if (cached) return JSON.parse(cached);
  const [items, pending] = await Promise.all([timeline(day), pendingAssignments()]);
  const prompt = `Write a short morning message for a student at Mesa School of Business (India) whose goals are:
${GOALS.map((g) => `- ${g}`).join('\n')}

Today: ${items.map((i) => `${fmtTime(i.start)} ${i.title}`).join('; ') || 'nothing scheduled'}.
Next deadlines: ${pending.slice(0, 3).map((a) => `"${a.title}" ${fmtRelative(a.due_at)}`).join('; ') || 'none'}.

Tone: warm, confident, specific, like a coach who believes in them. Speak as if they are already becoming that person.
No clichés like "unleash" or "journey", and no quotes from famous people. Vary it day to day (today is ${day}).`;
  const msg = await generateJson(prompt, SCHEMA);
  await setMeta(`morning:${day}`, JSON.stringify(msg));
  return msg;
}
