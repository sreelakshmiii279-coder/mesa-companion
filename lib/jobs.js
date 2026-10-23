import { getMeta, setMeta } from './db';
import { login, syncAssignmentsAndClasses, syncRecordings } from './lms';
import { dueReminders } from './planner';
import { processNextRecording } from './notes';
import { notify } from './push';
import { fmtRelative } from './time';

const MIN = 60_000;

/** Sends every reminder that is due now. Cheap: safe to call every minute. */
export async function sendReminders() {
  let sent = 0;
  for (const r of await dueReminders()) if (await notify(r)) sent++;
  return sent;
}

async function olderThan(key, minutes) {
  const last = await getMeta(key);
  return !last || Date.now() - Number(last) >= minutes * MIN;
}

/** Pulls fresh data from the portal (assignments every run, recordings every 2 hours). */
export async function syncPortal({ force = false } = {}) {
  if (!force && !(await olderThan('last_sync', 14))) return { skipped: true };
  const firstRun = !(await getMeta('last_sync'));
  const token = await login();
  const newAssignments = await syncAssignmentsAndClasses(token);
  let newRecordings = [];
  if (force || (await olderThan('last_recordings_sync', 120))) {
    newRecordings = await syncRecordings(token);
    await setMeta('last_recordings_sync', String(Date.now()));
  }
  await setMeta('last_sync', String(Date.now()));

  // The very first sync imports everything that already exists; don't announce all of it.
  if (!firstRun) {
    for (const a of newAssignments) {
      if (a.submitted || (a.due_at && new Date(a.due_at) < new Date())) continue;
      await notify({
        key: `new:${a.id}`, kind: 'assignment', url: '/deadlines',
        title: `New assignment: ${a.title}`,
        body: `${a.course ?? 'Mesa'}${a.due_at ? ` · due ${fmtRelative(a.due_at)}` : ''}`,
      });
    }
    for (const r of newRecordings) {
      await notify({
        key: `rec:${r.id}`, kind: 'recording', url: `/notes/${r.id}`,
        title: `New recording: ${r.course}`,
        body: `${r.title}. Notes will be ready in a few minutes.`,
      });
    }
  }
  return { newAssignments: newAssignments.length, newRecordings: newRecordings.length, firstRun };
}

/** Writes notes for one recording that needs them (takes 1-3 minutes). */
export async function makeNextNotes() {
  const rec = await processNextRecording();
  if (rec) await notify({
    key: `notes:${rec.id}`, kind: 'notes', url: `/notes/${rec.id}`,
    title: `Notes ready: ${rec.course}`, body: rec.title,
  });
  return rec;
}
