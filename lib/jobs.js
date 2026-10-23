import { getMeta, setMeta } from './db';
import { login, syncAssignmentsAndClasses, syncCourseContent } from './lms';
import { dueReminders } from './planner';
import { processNextRecording } from './notes';
import { processNextReading } from './readings';
import { scheduleChores, movedMessage } from './chores';
import { notify } from './push';
import { fmtRelative } from './time';

const MIN = 60_000;

/** Sends every reminder that is due now. Cheap: safe to call every minute. */
export async function sendReminders() {
  let sent = 0;
  for (const c of await scheduleChores()) if (await notify(movedMessage(c))) sent++;
  for (const r of await dueReminders()) if (await notify(r)) sent++;
  return sent;
}

async function olderThan(key, minutes) {
  const last = await getMeta(key);
  return !last || Date.now() - Number(last) >= minutes * MIN;
}

/** Pulls fresh data from the portal (assignments every run, course content every hour). */
export async function syncPortal({ force = false } = {}) {
  if (!force && !(await olderThan('last_sync', 14))) return { skipped: true };
  await setMeta('last_sync', String(Date.now()));
  const firstRun = !(await getMeta('initialized'));
  const token = await login();
  const newAssignments = await syncAssignmentsAndClasses(token);
  let content = { recordings: [], readings: [] };
  if (force || (await olderThan('last_content_sync', 60))) {
    content = await syncCourseContent(token);
    await setMeta('last_content_sync', String(Date.now()));
  }
  await setMeta('initialized', '1');

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
    for (const r of content.recordings) {
      await notify({
        key: `rec:${r.id}`, kind: 'recording', url: `/notes/${r.id}`,
        title: `New recording: ${r.course}`,
        body: `${r.title}. Notes will be ready soon.`,
      });
    }
    for (const r of content.readings) {
      await notify({
        key: `read:${r.id}`, kind: 'reading', url: `/learn/reading/${r.id}`,
        title: `New ${r.kind === 'pre' ? 'pre-read' : 'post-read'}: ${r.course}`,
        body: `${r.title}${r.summary_status === 'pending' ? '. Summary coming soon.' : ''}`,
      });
    }
  }
  return {
    newAssignments: newAssignments.length, newRecordings: content.recordings.length,
    newReadings: content.readings.length, firstRun,
  };
}

/** Summarises one reading (fast) if any need it, otherwise writes notes for one recording (1-3 min). */
export async function makeNextNotes() {
  const reading = await processNextReading();
  if (reading) {
    await notify({
      key: `sum:${reading.id}`, kind: 'reading', url: `/learn/reading/${reading.id}`,
      title: `Summary ready: ${reading.title}`, body: reading.course,
    });
    return { reading: `${reading.course} / ${reading.title}` };
  }
  const rec = await processNextRecording();
  if (rec) {
    await notify({
      key: `notes:${rec.id}`, kind: 'notes', url: `/notes/${rec.id}`,
      title: `Notes ready: ${rec.course}`, body: rec.title,
    });
    return { recording: `${rec.course} / ${rec.title}` };
  }
  return null;
}
