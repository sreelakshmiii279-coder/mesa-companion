// Chores: you list them, the app slots each one into a free gap in your calendar.
import { sql } from './db';
import { timeline } from './planner';
import { istDay, istToDate, addDays, fmtTime } from './time';

const MIN = 60_000;
const DAY_START = '07:30', DAY_END = '22:30', BUFFER = 10 * MIN, HORIZON_DAYS = 7;

const EMOJI = [
  [/laundry|clothes|wash|iron|fold/i, '🧺'], [/dish|kitchen|cook|meal|lunch|dinner/i, '🍳'],
  [/grocer|shop|buy|market|order/i, '🛒'], [/clean|tidy|vacuum|mop|dust|room/i, '🧹'],
  [/bill|pay|bank|rent|recharge|fee/i, '💸'], [/call|mom|dad|family|whatsapp/i, '📞'],
  [/trash|garbage|bin/i, '🗑️'], [/plant|water/i, '🪴'], [/doctor|med|pharmacy/i, '💊'],
];
export const choreEmoji = (title) => EMOJI.find(([re]) => re.test(title))?.[1] ?? '✅';

/** First gap of `len` ms between `from` and `to` that avoids every busy interval (with a buffer). */
function findGap(busy, from, to, len) {
  let cursor = from;
  for (const b of busy.filter((b) => b.end > from).sort((a, b) => a.start - b.start)) {
    if (b.start - BUFFER - cursor >= len) break;
    cursor = new Date(Math.max(cursor, b.end.getTime() + BUFFER));
  }
  return to - cursor >= len ? cursor : null;
}

/**
 * Slots auto-scheduled tasks into free gaps, highest priority first (then nearest done-by date).
 * replan: true re-slots every task that hasn't started yet, so a new high-priority task can take an
 * earlier slot; otherwise only unscheduled and missed tasks are placed (cheap enough for every tick).
 * Returns only the tasks moved because their slot was missed (those get a friendly heads-up).
 */
export async function scheduleChores(now = new Date(), { replan = false } = {}) {
  const chores = await sql`
    SELECT id, title, est_min, due_day::text AS due_day, due_at, slot_start, not_before, moves FROM chores
    WHERE NOT done AND (
      slot_start IS NULL
      OR slot_start + est_min * interval '1 minute' < ${now}
      OR (${replan} AND slot_start > ${now}))
    ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, due_day NULLS LAST, created_at`;
  if (!chores.length) return [];

  const today = istDay(now);
  const days = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));
  const pending = new Set(chores.map((c) => c.id));
  // Finished auto-slotted tasks free up their time; ones being re-planned are placed again below.
  const lines = await Promise.all(days.map((d) => timeline(d)));
  const busy = Object.fromEntries(days.map((d, i) => [
    d, lines[i].filter((it) => !(it.type === 'chore' && (it.done || pending.has(it.id)))),
  ]));

  const moved = [];
  for (const c of chores) {
    const len = c.est_min * MIN;
    const earliest = Math.max(now.getTime() + 5 * MIN, c.not_before ? new Date(c.not_before).getTime() : 0);
    const last = c.due_day && c.due_day >= today ? c.due_day : days.at(-1);
    let slot = null;
    // Linked to an assignment: the slot must finish 30 min before the exact deadline.
    const deadline = c.due_at ? new Date(c.due_at).getTime() - 30 * MIN : Infinity;
    for (const d of days.filter((d) => d <= last)) {
      const from = new Date(Math.max(istToDate(d, DAY_START), earliest));
      slot = findGap(busy[d], from, new Date(Math.min(istToDate(d, DAY_END), deadline)), len);
      if (slot) { busy[d].push({ start: slot, end: new Date(slot.getTime() + len) }); break; }
    }
    // No room before the due date: put it first thing tomorrow-ish rather than drop it.
    slot ??= new Date(Math.max(istToDate(addDays(today, 1), DAY_START), earliest));
    const missed = c.slot_start && new Date(c.slot_start).getTime() + len < now.getTime();
    await sql`UPDATE chores SET slot_start = ${slot}, moves = moves + ${missed ? 1 : 0} WHERE id = ${c.id}`;
    if (missed) moved.push({ ...c, moves: c.moves + 1, slot_start: slot });
  }
  return moved;
}

/** Priority from how soon something is due: under 2 days high, under 5 days medium, else low. */
export function urgencyPriority(dueAt, now = new Date()) {
  const h = (new Date(dueAt) - now) / 3600_000;
  return h < 48 ? 'high' : h < 120 ? 'medium' : 'low';
}

/**
 * Keeps one auto-slotted college task per pending portal assignment.
 * New assignment -> new task; submitted / ticked off -> task done; priority climbs as the deadline nears
 * (unless you set it yourself). Tasks you deleted stay deleted.
 */
export async function syncAssignmentTasks(now = new Date()) {
  const pending = await sql`
    SELECT id, title, due_at FROM assignments
    WHERE NOT submitted AND NOT marked_done AND due_at > ${now}`;
  for (const a of pending) {
    const prio = urgencyPriority(a.due_at, now);
    await sql`
      INSERT INTO chores (title, est_min, due_day, due_at, category, priority, auto_priority, assignment_id)
      VALUES (${a.title}, 60, ${istDay(a.due_at)}, ${a.due_at}, 'college', ${prio}, true, ${a.id})
      ON CONFLICT (assignment_id) DO UPDATE SET
        due_at = EXCLUDED.due_at, due_day = EXCLUDED.due_day,
        priority = CASE WHEN chores.auto_priority THEN EXCLUDED.priority ELSE chores.priority END`;
  }
  // Submitted, ticked off, or past due: the linked task is done.
  await sql`
    UPDATE chores c SET done = true FROM assignments a
    WHERE c.assignment_id = a.id AND NOT c.done AND (a.submitted OR a.marked_done OR a.due_at <= ${now})`;
  return pending.length;
}

/** Friendly heads-up when a missed chore gets a new slot. */
export function movedMessage(c) {
  const when = istDay(c.slot_start) === istDay() ? fmtTime(c.slot_start) : `tomorrow, ${fmtTime(c.slot_start)}`;
  const lines = [
    `No stress, life happens. I moved it to ${when}.`,
    `Slid it to ${when}. Future you says thanks.`,
    `New slot: ${when}. ${c.est_min} min and it's gone forever.`,
  ];
  return {
    key: `moved:${c.id}:${c.slot_start.getTime()}`, kind: 'chore', url: '/plan',
    title: `${choreEmoji(c.title)} ${c.title}: rescheduled`, body: lines[c.moves % lines.length],
  };
}
