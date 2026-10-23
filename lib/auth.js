import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const COOKIE = 'mc_session';

export function sessionToken() {
  return createHmac('sha256', process.env.SESSION_SECRET).update('mesa-companion').digest('hex');
}

export function checkPassword(pw) {
  const a = Buffer.from(String(pw ?? '')), b = Buffer.from(process.env.APP_PASSWORD ?? '');
  return a.length === b.length && b.length > 0 && timingSafeEqual(a, b);
}

export async function isAuthed() {
  const c = (await cookies()).get(COOKIE)?.value;
  return !!c && c === sessionToken();
}

export async function requireAuth() {
  if (!(await isAuthed())) redirect('/login');
}

/** For cron routes: GitHub Actions sends `Authorization: Bearer <CRON_SECRET>`. */
export function isCron(req) {
  const h = req.headers.get('authorization') ?? '';
  return !!process.env.CRON_SECRET && h === `Bearer ${process.env.CRON_SECRET}`;
}
