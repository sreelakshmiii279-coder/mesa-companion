'use server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { istDay, addDays } from '@/lib/time';
import { scheduleChores } from '@/lib/chores';

const REPEATS = ['none', 'daily', 'weekdays'];

export async function addTask(form) {
  await requireAuth();
  const title = String(form.get('title') ?? '').trim().slice(0, 120);
  const day = String(form.get('day') || istDay());
  const start = String(form.get('start') ?? '');
  const duration = Math.min(720, Math.max(5, Number(form.get('duration')) || 30));
  const repeat = REPEATS.includes(form.get('repeat')) ? form.get('repeat') : 'none';
  if (!title || !/^\d{2}:\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  await sql`INSERT INTO tasks (title, day, start_time, duration_min, repeat)
            VALUES (${title}, ${day}, ${start}, ${duration}, ${repeat})`;
  revalidatePath('/', 'layout');
}

export async function updateTask(form) {
  await requireAuth();
  const id = Number(form.get('id'));
  const title = String(form.get('title') ?? '').trim().slice(0, 120);
  const day = String(form.get('day') ?? '');
  const start = String(form.get('start') ?? '');
  const duration = Math.min(720, Math.max(5, Number(form.get('duration')) || 30));
  const repeat = REPEATS.includes(form.get('repeat')) ? form.get('repeat') : 'none';
  if (!id || !title || !/^\d{2}:\d{2}/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  await sql`UPDATE tasks SET title = ${title}, day = ${day}, start_time = ${start.slice(0, 5)},
            duration_min = ${duration}, repeat = ${repeat} WHERE id = ${id}`;
  // Chores may have been sitting in the slot this task now takes.
  await sql`UPDATE chores SET slot_start = NULL WHERE NOT done AND slot_start > now()`;
  await scheduleChores();
  revalidatePath('/', 'layout');
}

export async function deleteTask(form) {
  await requireAuth();
  await sql`DELETE FROM tasks WHERE id = ${Number(form.get('id'))}`;
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

export async function addChore(form) {
  await requireAuth();
  const title = String(form.get('title') ?? '').trim().slice(0, 120);
  const est = Math.min(240, Math.max(5, Number(form.get('est_min')) || 20));
  const due = String(form.get('due_day') ?? '');
  if (!title) return;
  await sql`INSERT INTO chores (title, est_min, due_day)
            VALUES (${title}, ${est}, ${/^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null})`;
  await scheduleChores();
  revalidatePath('/', 'layout');
}

/** Edit a chore; it gets a fresh slot that fits the new length / due date. */
export async function updateChore(form) {
  await requireAuth();
  const id = Number(form.get('id'));
  const title = String(form.get('title') ?? '').trim().slice(0, 120);
  const est = Math.min(240, Math.max(5, Number(form.get('est_min')) || 20));
  const due = String(form.get('due_day') ?? '');
  if (!id || !title) return;
  await sql`UPDATE chores SET title = ${title}, est_min = ${est},
            due_day = ${/^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null}, slot_start = NULL WHERE id = ${id}`;
  await scheduleChores();
  revalidatePath('/', 'layout');
}

export async function toggleChore(form) {
  await requireAuth();
  await sql`UPDATE chores SET done = NOT done WHERE id = ${Number(form.get('id'))}`;
  revalidatePath('/', 'layout');
}

/** "Not now": drop the current slot and find the next free one. */
export async function rescheduleChore(form) {
  await requireAuth();
  await sql`UPDATE chores SET slot_start = NULL WHERE id = ${Number(form.get('id'))} AND NOT done`;
  await scheduleChores(new Date(Date.now() + 30 * 60_000));
  revalidatePath('/', 'layout');
}

export async function deleteChore(form) {
  await requireAuth();
  await sql`DELETE FROM chores WHERE id = ${Number(form.get('id'))}`;
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
