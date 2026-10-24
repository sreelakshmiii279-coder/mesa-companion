'use server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { istDay, addDays } from '@/lib/time';
import { scheduleChores } from '@/lib/chores';
import { cleanCategory, cleanPriority } from '@/lib/categories';

const REPEATS = ['none', 'daily', 'weekdays'];
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Reads the shared add/edit form. mode: "fixed" (set time → tasks) or "flex" (find a slot → chores). */
function readItem(form) {
  const mode = form.get('mode') === 'flex' ? 'flex' : 'fixed';
  const due = String(form.get('due_day') ?? '');
  return {
    mode,
    title: String(form.get('title') ?? '').trim().slice(0, 120),
    category: cleanCategory(form.get('category')),
    priority: cleanPriority(form.get('priority')),
    minutes: Math.min(720, Math.max(5, Number(form.get('duration')) || 30)),
    day: String(form.get('day') || istDay()),
    start: String(form.get('start') ?? '').slice(0, 5),
    repeat: REPEATS.includes(form.get('repeat')) ? form.get('repeat') : 'none',
    due: isDay(due) ? due : null,
  };
}

async function insertItem(it) {
  if (!it.title) return;
  if (it.mode === 'fixed') {
    if (!/^\d{2}:\d{2}$/.test(it.start) || !isDay(it.day)) return;
    await sql`INSERT INTO tasks (title, day, start_time, duration_min, repeat, category, priority)
              VALUES (${it.title}, ${it.day}, ${it.start}, ${it.minutes}, ${it.repeat}, ${it.category}, ${it.priority})`;
  } else {
    await sql`INSERT INTO chores (title, est_min, due_day, category, priority)
              VALUES (${it.title}, ${it.minutes}, ${it.due}, ${it.category}, ${it.priority})`;
  }
  await scheduleChores(new Date(), { replan: true });
}

export async function addItem(form) {
  await requireAuth();
  await insertItem(readItem(form));
  revalidatePath('/', 'layout');
}

/** Edit any task. Switching between "set time" and "find a slot" moves it to the other list. */
export async function updateItem(form) {
  await requireAuth();
  const id = Number(form.get('id'));
  const kind = form.get('kind') === 'chore' ? 'chore' : 'task';
  const it = readItem(form);
  if (!id || !it.title) return;
  const sameKind = (kind === 'chore') === (it.mode === 'flex');
  if (!sameKind) {
    if (kind === 'chore') await sql`DELETE FROM chores WHERE id = ${id}`;
    else await sql`DELETE FROM tasks WHERE id = ${id}`;
    await insertItem(it);
  } else if (kind === 'task') {
    if (!/^\d{2}:\d{2}$/.test(it.start) || !isDay(it.day)) return;
    await sql`UPDATE tasks SET title = ${it.title}, day = ${it.day}, start_time = ${it.start}, duration_min = ${it.minutes},
              repeat = ${it.repeat}, category = ${it.category}, priority = ${it.priority} WHERE id = ${id}`;
    await scheduleChores(new Date(), { replan: true });
  } else {
    await sql`UPDATE chores SET title = ${it.title}, est_min = ${it.minutes}, due_day = ${it.due},
              category = ${it.category}, priority = ${it.priority} WHERE id = ${id}`;
    await scheduleChores(new Date(), { replan: true });
  }
  revalidatePath('/', 'layout');
}

export async function deleteItem(form) {
  await requireAuth();
  const id = Number(form.get('id'));
  if (form.get('kind') === 'chore') await sql`DELETE FROM chores WHERE id = ${id}`;
  else await sql`DELETE FROM tasks WHERE id = ${id}`;
  await scheduleChores(new Date(), { replan: true });
  revalidatePath('/', 'layout');
}

export async function toggleTaskDone(form) {
  await requireAuth();
  const id = Number(form.get('id')), day = String(form.get('day'));
  const del = await sql`DELETE FROM task_done WHERE task_id = ${id} AND day = ${day} RETURNING task_id`;
  if (!del.length) await sql`INSERT INTO task_done (task_id, day) VALUES (${id}, ${day}) ON CONFLICT DO NOTHING`;
  revalidatePath('/', 'layout');
}

/** One-off tasks only: push to the next day, same time. */
export async function moveToTomorrow(form) {
  await requireAuth();
  const id = Number(form.get('id'));
  await sql`UPDATE tasks SET day = ${addDays(istDay(), 1)} WHERE id = ${id} AND repeat = 'none'`;
  revalidatePath('/', 'layout');
}

export async function toggleAssignment(form) {
  await requireAuth();
  await sql`UPDATE assignments SET marked_done = NOT marked_done WHERE id = ${String(form.get('id'))}`;
  revalidatePath('/', 'layout');
}

export async function toggleChore(form) {
  await requireAuth();
  await sql`UPDATE chores SET done = NOT done WHERE id = ${Number(form.get('id'))}`;
  await scheduleChores(new Date(), { replan: true });
  revalidatePath('/', 'layout');
}

/** "Not now": drop the current slot and find the next free one. */
export async function rescheduleChore(form) {
  await requireAuth();
  // Not before the end of its current slot (or 30 min from now), then re-plan everything.
  await sql`UPDATE chores SET not_before = greatest(now() + interval '30 minutes',
              coalesce(slot_start + est_min * interval '1 minute', now()))
            WHERE id = ${Number(form.get('id'))} AND NOT done`;
  await scheduleChores(new Date(), { replan: true });
  revalidatePath('/', 'layout');
}

export async function toggleReadingRead(form) {
  await requireAuth();
  await sql`UPDATE readings SET is_read = NOT is_read WHERE id = ${String(form.get('id'))}`;
  revalidatePath('/', 'layout');
}

export async function markAllRead() {
  await requireAuth();
  await sql`UPDATE notifications SET read = true WHERE NOT read`;
  revalidatePath('/', 'layout');
}
