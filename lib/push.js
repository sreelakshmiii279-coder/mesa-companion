import webpush from 'web-push';
import { sql } from './db';

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(
    process.env.APP_URL || 'https://mesa-companion.vercel.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  ready = true;
}

/**
 * Adds a notification to the in-app feed and pushes it to every subscribed phone.
 * The same key is only ever sent once. Returns true if it was new.
 */
export async function notify({ key, kind, title, body = '', url = '/' }) {
  const rows = await sql`
    INSERT INTO notifications (dedupe_key, kind, title, body, url)
    VALUES (${key}, ${kind}, ${title}, ${body}, ${url})
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`;
  if (!rows.length) return false;

  setup();
  const subs = await sql`SELECT endpoint, sub FROM push_subs`;
  const payload = JSON.stringify({ title, body, url, tag: key });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s.sub, payload, { TTL: 3600, urgency: 'high' });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await sql`DELETE FROM push_subs WHERE endpoint = ${s.endpoint}`;
      else console.error('push failed', e.statusCode, e.body);
    }
  }));
  return true;
}
