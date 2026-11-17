import { getMeta, setMeta } from './db';
import { login, syncAssignmentsAndClasses, syncCourseContent } from './lms';
import { dueReminders } from './planner';
import { processNextRecording } from './notes';
import { processNextReading } from './readings';
import { scheduleChores, movedMessage, syncAssignmentTasks } from './chores';
import { notify } from './push';
import { buildGuide, STUDY_COURSES } from './study';
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
  // Every pending assignment becomes a task, then the whole plan is re-slotted by priority.
  await syncAssignmentTasks();
  await scheduleChores(new Date(), { replan: true });
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
        body: `${a.course ?? 'Mesa'}${a.due_at ? ` · due ${fmtRelative(a.due_at)}` : ''}. Added to your tasks with a slot before the deadline.`,
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

/** New material for a course that has a study guide: rebuild that session's guide (about a minute). */
async function refreshStudyGuide(course, title) {
  const slug = Object.keys(STUDY_COURSES).find((k) => STUDY_COURSES[k].match.test(course));
  const session = Number((title.match(/session\s*0?(\d+)/i) || [])[1]);
  if (!slug || !session) return null;
  try {
    await buildGuide(slug, session);
    await notify({
      key: `study:${slug}:${session}:${Date.now()}`, kind: 'notes', url: `/study/${slug}?s=${session}`,
      title: `Study guide updated: ${STUDY_COURSES[slug].name}, Session ${session}`, body: 'New material from Nexus is in.',
    });
    return `${slug} session ${session}`;
  } catch (e) {
    console.error('study guide refresh failed', e);
    return null;
  }
}

/** Summarises one reading (fast) if any need it, otherwise writes notes for one recording (1-3 min).
 *  Either way, a study guide for that course session is rebuilt with the new material. */
export async function makeNextNotes() {
  const reading = await processNextReading();
  if (reading) {
    await notify({
      key: `sum:${reading.id}`, kind: 'reading', url: `/learn/reading/${reading.id}`,
      title: `Summary ready: ${reading.title}`, body: reading.course,
    });
    const guide = await refreshStudyGuide(reading.course, reading.title);
    return { reading: `${reading.course} / ${reading.title}`, guide };
  }
  const rec = await processNextRecording();
  if (rec) {
    await notify({
      key: `notes:${rec.id}`, kind: 'notes', url: `/notes/${rec.id}`,
      title: `Notes ready: ${rec.course}`, body: rec.title,
    });
    const guide = await refreshStudyGuide(rec.course, rec.title);
    return { recording: `${rec.course} / ${rec.title}`, guide };
  }
  return null;
}
