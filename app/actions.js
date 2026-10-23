'use server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { istDay, addDays } from '@/lib/time';

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

export async function markAllRead() {
  await requireAuth();
  await sql`UPDATE notifications SET read = true WHERE NOT read`;
  revalidatePath('/', 'layout');
}
