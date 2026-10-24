// Builds a day's timeline (classes + your tasks) and works out which reminders are due.
import { sql } from './db';
import { istDay, istToDate, addDays, weekday, fmtTime, fmtDay, fmtDuration, fmtRelative } from './time';
import { choreEmoji } from './chores';
import { category } from './categories';

// Chill time gets its own, very relaxed nudges.
const CHILL_START = [
  (c) => `Chill time 😌 ${c.minutes} min of zero guilt. You earned it.`,
  (c) => `Phone down on work, feet up. ${c.plain} for ${c.minutes} min.`,
];

// Chore nudges: casual, upbeat, never naggy. Picked by chore id so they vary.
const CHORE_PRE = [
  (c) => `${c.minutes} min for ${c.plain} in 10. Quick win incoming.`,
  (c) => `Heads up: ${c.plain} at ${fmtTime(c.start)}. Put a playlist on and it's done before you know it.`,
  (c) => `${c.plain} in 10 min. Small task, big "I've got my life together" energy.`,
];
const CHORE_START = [
  (c) => `It's ${c.plain} o'clock. ${c.minutes} min, then it's off your plate. Go go go.`,
  (c) => `${c.plain} time. Timer on, ${c.minutes} min, done. You've got this.`,
  (c) => `Let's knock out ${c.plain}. ${c.minutes} minutes and you're free.`,
];

const MIN = 60_000;

function occursOn(task, day) {
  if (task.repeat === 'none') return task.day === day;
  if (day < task.day) return false;
  if (task.repeat === 'weekdays') return weekday(day) >= 1 && weekday(day) <= 5;
  return task.repeat === 'daily';
}

/** Everything scheduled on an IST day, sorted by start. */
export async function timeline(day = istDay()) {
  const dayStart = istToDate(day, '00:00'), dayEnd = new Date(dayStart.getTime() + 1440 * MIN);
  const [tasks, done, classes, chores] = await Promise.all([
    sql`SELECT id, title, day::text AS day, start_time::text AS start_time, duration_min, repeat, category, priority FROM tasks`,
    sql`SELECT task_id FROM task_done WHERE day = ${day}`,
    sql`SELECT * FROM classes WHERE start_at >= ${dayStart} AND start_at < ${dayEnd}`,
    sql`SELECT * FROM chores WHERE slot_start >= ${dayStart} AND slot_start < ${dayEnd}`,
  ]);
  const doneIds = new Set(done.map((d) => d.task_id));
  const emojiFor = (t) => (t.category === 'house' ? choreEmoji(t.title) : category(t.category).emoji);
  const items = [
    ...chores.map((c) => ({
      key: `chore:${c.id}:${new Date(c.slot_start).getTime()}`, type: 'chore', id: c.id,
      title: c.title, plain: c.title, minutes: c.est_min, category: c.category, priority: c.priority, emoji: emojiFor(c),
      start: new Date(c.slot_start), end: new Date(new Date(c.slot_start).getTime() + c.est_min * MIN), done: c.done,
    })),
    ...classes.map((c) => ({
      key: `class:${c.id}`, type: 'class', id: c.id, title: c.title, detail: [c.room, c.instructor].filter(Boolean).join(' · '),
      emoji: '🎓', start: new Date(c.start_at), end: new Date(c.end_at), done: false,
    })),
    ...tasks.filter((t) => occursOn(t, day)).map((t) => {
      const start = istToDate(day, String(t.start_time).slice(0, 5));
      return {
        key: `task:${t.id}:${day}`, type: 'task', id: t.id, title: t.title, plain: t.title, repeat: t.repeat,
        category: t.category, priority: t.priority, emoji: emojiFor(t), minutes: t.duration_min,
        start, end: new Date(start.getTime() + t.duration_min * MIN), done: doneIds.has(t.id),
      };
    }),
  ];
  return items.sort((a, b) => a.start - b.start);
}

/** Assignments still to do, soonest due first. */
export async function pendingAssignments() {
  return sql`SELECT * FROM assignments WHERE NOT submitted AND NOT marked_done AND due_at > now()
             ORDER BY due_at`;
}

/** Your own auto-slotted tasks that have a done-by date, shaped like assignments for the due lists. */
export async function ownDueTasks() {
  const rows = await sql`SELECT *, due_day::text AS due_day FROM chores WHERE NOT done AND chores.due_day IS NOT NULL ORDER BY chores.due_day`;
  return rows.map((c) => ({
    id: `own-${c.id}`, choreId: c.id, kind: 'own', title: c.title, priority: c.priority,
    course: `Your task${c.slot_start ? ` · slotted ${fmtDay(c.slot_start)}, ${fmtTime(c.slot_start)}` : ''}`,
    due_at: istToDate(c.due_day, '23:59'),
  }));
}

/** Portal assignments and your own done-by tasks together, soonest first. */
export async function allDue() {
  const [a, own] = await Promise.all([pendingAssignments(), ownDueTasks()]);
  return [...a, ...own].sort((x, y) => new Date(x.due_at) - new Date(y.due_at));
}

/** Free gaps (>= 20 min) between `from` and the end of the day's last item. */
export function freeGaps(items, from = new Date()) {
  const gaps = [];
  let cursor = from;
  for (const it of items) {
    if (it.end <= cursor) continue;
    if (it.start - cursor >= 20 * MIN) gaps.push({ start: cursor, end: it.start, before: it });
    if (it.end > cursor) cursor = it.end;
  }
  return gaps;
}

function suggestion(pending, gapMin) {
  const a = pending[0];
  if (!a) return '';
  return gapMin >= 30 ? ` Good slot for "${a.title}" (due ${fmtRelative(a.due_at)}).` : '';
}

/**
 * Reminders whose time has come. `now` minus up to `lateMin` is still sent (the scheduler can run late).
 * Text is written at send time, so "x min left" is always accurate.
 */
export async function dueReminders(now = new Date(), lateMin = 20) {
  const day = istDay(now);
  const [items, pending] = await Promise.all([timeline(day), pendingAssignments()]);
  const out = [];
  const due = (t) => t <= now && now - t < lateMin * MIN;
  const left = (t) => fmtDuration((t - now) / MIN);
  const live = items.filter((i) => !i.done);

  live.forEach((it, idx) => {
    const next = live.slice(idx + 1).find((n) => n.start >= it.end);
    const label = it.type === 'class' ? `${it.title}${it.detail ? ` (${it.detail})` : ''}` : it.title;
    // Your own tasks carry their type emoji, and 🔥 when they're high priority.
    const name = it.type === 'class' ? it.title : `${it.priority === 'high' ? '🔥 ' : ''}${it.emoji} ${it.title}`;
    const pick = (list) => list[it.id % list.length](it);

    if (it.category === 'chill' && it.type !== 'class') {
      if (due(it.start) && it.end > now) {
        out.push({ key: `start:${it.key}`, kind: 'planner', url: '/plan', title: `${name}, now`, body: pick(CHILL_START) });
      }
      return;
    }

    if (it.type === 'chore') {
      if (due(new Date(it.start - 10 * MIN)) && it.start > now) {
        out.push({ key: `pre:${it.key}`, kind: 'chore', url: '/plan', title: `${name} in 10`, body: pick(CHORE_PRE) });
      }
      if (due(it.start) && it.end > now) {
        out.push({ key: `start:${it.key}`, kind: 'chore', url: '/plan', title: `${name}, now`, body: pick(CHORE_START) });
      }
      return;
    }

    // 15 min before: tell them how long they have to wrap up.
    const pre = new Date(it.start - 15 * MIN);
    if (due(pre) && it.start > now) out.push({
      key: `pre:${it.key}`, kind: 'planner', url: '/',
      title: `${name} at ${fmtTime(it.start)}`,
      body: `You have ${left(it.start)} to wrap up what you're doing. ${it.type === 'class' ? 'Class' : 'Next'}: ${label}.`,
    });

    // At the start of your own tasks.
    if (it.type === 'task' && due(it.start) && it.end > now) out.push({
      key: `start:${it.key}`, kind: 'planner', url: '/',
      title: `Time for ${name}`,
      body: `${fmtDuration((it.end - it.start) / MIN)}, until ${fmtTime(it.end)}.${next ? ` After that: ${next.title} at ${fmtTime(next.start)}.` : ''}`,
    });

    // 10 min before the end of a longer task.
    const ending = new Date(it.end - 10 * MIN);
    if (it.type === 'task' && it.end - it.start >= 30 * MIN && due(ending) && it.end > now) out.push({
      key: `ending:${it.key}`, kind: 'planner', url: '/',
      title: `${left(it.end)} left on ${name}`,
      body: next ? `Next up: ${next.title} at ${fmtTime(next.start)}.` : 'Nothing else scheduled after this.',
    });

    // When something ends and a free gap follows: say how much time there is and what to do with it.
    if (due(it.end) && next && next.start - it.end >= 20 * MIN) {
      const gapMin = (next.start - now) / MIN;
      out.push({
        key: `gap:${it.key}`, kind: 'planner', url: '/',
        title: `Free for ${fmtDuration(gapMin)}`,
        body: `${next.title} is at ${fmtTime(next.start)}.${suggestion(pending, gapMin)}`,
      });
    }
  });

  // Assignment deadlines: 3 days, 1 day, 3 hours and 1 hour before.
  for (const a of pending) {
    for (const [tag, h] of [['3d', 72], ['1d', 24], ['3h', 3], ['1h', 1]]) {
      const t = new Date(new Date(a.due_at) - h * 3600_000);
      if (t <= now && now - t < 60 * MIN) out.push({
        key: `due${tag}:${a.id}`, kind: 'deadline', url: '/deadlines',
        title: `Due ${fmtRelative(a.due_at, now)}: ${a.title}`,
        body: `${a.course ?? 'Assignment'} · due ${fmtTime(a.due_at)}, ${new Date(a.due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}.`,
      });
    }
  }

  // 8:00 AM brief and 9:30 PM wrap-up.
  const brief = istToDate(day, '08:00');
  if (now >= brief && now - brief < 60 * MIN) {
    const classes = items.filter((i) => i.type === 'class').length;
    const tasks = items.filter((i) => i.type === 'task').length;
    const week = pending.filter((a) => new Date(a.due_at) - now < 7 * 86_400_000);
    out.push({
      key: `brief:${day}`, kind: 'brief', url: '/',
      title: 'Good morning! Your day',
      body: `${classes} class${classes === 1 ? '' : 'es'}, ${tasks} task${tasks === 1 ? '' : 's'} planned. ` +
        (week.length ? `${week.length} due this week, next: "${week[0].title}" ${fmtRelative(week[0].due_at, now)}.` : 'Nothing due this week.'),
    });
  }
  // 9 AM: your own tasks due today.
  const nine = istToDate(day, '09:00');
  if (now >= nine && now - nine < 60 * MIN) {
    for (const t of (await ownDueTasks()).filter((t) => istDay(t.due_at) === day)) out.push({
      key: `owndue:${t.choreId}:${day}`, kind: 'deadline', url: '/plan',
      title: `${t.priority === 'high' ? '🔥 ' : ''}Due today: ${t.title}`,
      body: t.course.replace('Your task · slotted', 'Slotted for'),
    });
  }

  // 8 PM: unread pre-reads for tomorrow's classes.
  const prep = istToDate(day, '20:00');
  if (now >= prep && now - prep < 60 * MIN) {
    const tomorrowStart = istToDate(addDays(day, 1), '00:00');
    const unread = await sql`
      SELECT DISTINCT r.id, r.title, r.course FROM readings r
      JOIN classes c ON c.course = r.course
      WHERE r.kind = 'pre' AND NOT r.is_read
        AND c.start_at >= ${tomorrowStart} AND c.start_at < ${new Date(tomorrowStart.getTime() + 1440 * MIN)}`;
    if (unread.length) out.push({
      key: `prep:${day}`, kind: 'reading', url: '/learn',
      title: `${unread.length} pre-read${unread.length === 1 ? '' : 's'} for tomorrow's classes`,
      body: unread.slice(0, 3).map((r) => `${r.course.split(' with ')[0]}: ${r.title}`).join(' · ') + '. Summaries are ready if you are short on time.',
    });
  }

  const wrap = istToDate(day, '21:30');
  if (now >= wrap && now - wrap < 60 * MIN) {
    const left = items.filter((i) => i.type === 'task' && !i.done && i.repeat === 'none');
    if (left.length) out.push({
      key: `wrap:${day}`, kind: 'planner', url: '/plan',
      title: `${left.length} task${left.length === 1 ? '' : 's'} not done today`,
      body: 'Tap to tick them off or move them to tomorrow.',
    });
  }
  return out;
}
