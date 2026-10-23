// Reads the Mesa student LMS JSON API (the same one the portal's own pages use).
import { sql, getMeta, setMeta } from './db';

const APP_URL = 'https://students.mesaschool.co.in';
const API_URL = 'https://api-students.mesaschool.co.in/api/v1';
export const PORTAL_ASSIGNMENTS = `${APP_URL}/student/lms/assignments`;

async function http(method, url, { body, token } = {}) {
  const headers = { Accept: 'application/json', 'User-Agent': 'mesa-companion/1.0' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body && JSON.stringify(body), cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.replace(API_URL, '')} -> ${res.status}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  return json?.data ?? json;
}

export async function login() {
  const data = await http('POST', `${APP_URL}/api/auth/login`, {
    body: { identifier: process.env.LMS_IDENTIFIER, password: process.env.LMS_PASSWORD },
  });
  if (data.mfaRequired) throw new Error('Portal login now asks for a code (MFA); sync cannot continue.');
  if (!data.accessToken) throw new Error('Portal login returned no access token.');
  return data.accessToken;
}

const get = (token, path) => http('GET', API_URL + path, { token });

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' };
const stripHtml = (s) => s
  ? s.replace(/<[^>]+>/g, ' ').replace(/&(nbsp|amp|quot|#39|lt|gt);/g, (m) => ENTITIES[m]).replace(/\s+/g, ' ').trim()
  : null;

const SUBMITTED = ['submitted', 'graded', 'turned_in', 'completed', 'late_submitted', 'returned'];

/** Pulls assignments and the next two weeks of classes. Returns newly seen assignments. */
export async function syncAssignmentsAndClasses(token) {
  const assignments = await get(token, '/assignments/my');
  const list = Array.isArray(assignments) ? assignments : assignments.assignments ?? [];
  const fresh = [];
  for (const a of list) {
    const submitted = SUBMITTED.includes(String(a.mySubmissionStatus ?? '').toLowerCase());
    const rows = await sql`
      INSERT INTO assignments (id, title, course, description, due_at, submitted)
      VALUES (${a.id}, ${a.title}, ${a.courseTitle}, ${stripHtml(a.description)?.slice(0, 2000) ?? null},
              ${a.dueAt}, ${submitted})
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, course = EXCLUDED.course,
        description = EXCLUDED.description, due_at = EXCLUDED.due_at, submitted = EXCLUDED.submitted,
        updated_at = now()
      RETURNING (xmax = 0) AS inserted, *`;
    if (rows[0].inserted) fresh.push(rows[0]);
  }

  const now = Date.now();
  const q = new URLSearchParams({
    from: new Date(now - 86_400_000).toISOString(),
    to: new Date(now + 14 * 86_400_000).toISOString(),
  });
  const events = await get(token, `/events/my?${q}`);
  const evList = Array.isArray(events) ? events : events.events ?? [];
  let termId = null;
  for (const e of evList) {
    if (e.status === 'cancelled') { await sql`DELETE FROM classes WHERE id = ${e.id}`; continue; }
    if (e.termName === 'Term 2') termId = e.termId;
    await sql`
      INSERT INTO classes (id, title, course, instructor, room, start_at, end_at)
      VALUES (${e.id}, ${e.title}, ${e.courseName}, ${e.instructorName}, ${e.room}, ${e.startAt}, ${e.endAt})
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, course = EXCLUDED.course,
        instructor = EXCLUDED.instructor, room = EXCLUDED.room, start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at, updated_at = now()`;
  }
  if (termId) await setMeta('term2_id', termId);
  return fresh;
}

/** Pre-reads live in "prereads" topics; post-reads in custom topics titled like "Post Reads". */
function readingKind(topic) {
  if (topic.type === 'prereads' || /pre[\s-]?read/i.test(topic.title)) return 'pre';
  if (/post[\s-]?read/i.test(topic.title)) return 'post';
  return null;
}

/** Lists every Term 2 class recording, pre-read and post-read. Returns the newly seen ones. */
export async function syncCourseContent(token) {
  const termId = await getMeta('term2_id');
  if (!termId) return { recordings: [], readings: [] };
  const { courses } = await get(token, `/curriculum/courses?termId=${encodeURIComponent(termId)}`);
  const fresh = { recordings: [], readings: [] };
  for (const c of courses) {
    const { topics } = await get(token, `/curriculum/topics?courseId=${encodeURIComponent(c.id)}`);
    for (const t of topics.filter((t) => t.type === 'recordings')) {
      const { recordings } = await get(token, `/content/topics/${encodeURIComponent(t.id)}/recordings`);
      for (const r of recordings.filter((r) => r.isPublished && r.videoUrl)) {
        const rows = await sql`
          INSERT INTO recordings (id, course, title, video_url, thumbnail, recorded_on)
          VALUES (${r.id}, ${c.title}, ${r.title}, ${r.videoUrl}, ${r.thumbnailUrl}, ${r.recordedOn})
          ON CONFLICT (id) DO UPDATE SET course = EXCLUDED.course, title = EXCLUDED.title,
            video_url = EXCLUDED.video_url, thumbnail = EXCLUDED.thumbnail, recorded_on = EXCLUDED.recorded_on
          RETURNING (xmax = 0) AS inserted, *`;
        if (rows[0].inserted) fresh.recordings.push(rows[0]);
      }
    }
    for (const t of topics) {
      const kind = readingKind(t);
      if (!kind) continue;
      const { materials } = await get(token, `/content/topics/${encodeURIComponent(t.id)}/materials`);
      for (const m of materials.filter((m) => m.isPublished)) {
        const body = m.kind === 'text' ? stripHtml(m.content) : null;
        const linkUrl = m.kind === 'link' ? m.url : (m.content?.match(/href="([^"]+)"/)?.[1] ?? null);
        // Only PDFs and real text can be summarised; spreadsheets, links etc. are listed as-is.
        const canSummarise = (m.kind === 'file' && m.fileType === 'pdf') || (body && body.length > 400);
        const rows = await sql`
          INSERT INTO readings (id, course, kind, title, file_name, file_type, link_url, body, posted_at, summary_status)
          VALUES (${m.id}, ${c.title}, ${kind}, ${m.title}, ${m.fileName}, ${m.fileType}, ${linkUrl}, ${body},
                  ${m.createdAt}, ${canSummarise ? 'pending' : 'skip'})
          ON CONFLICT (id) DO UPDATE SET course = EXCLUDED.course, kind = EXCLUDED.kind, title = EXCLUDED.title,
            file_name = EXCLUDED.file_name, file_type = EXCLUDED.file_type, link_url = EXCLUDED.link_url,
            body = EXCLUDED.body
          RETURNING (xmax = 0) AS inserted, *`;
        if (rows[0].inserted) fresh.readings.push(rows[0]);
      }
    }
  }
  return fresh;
}

/** Short-lived download link for a portal file. */
export async function materialUrl(token, id) {
  const data = await get(token, `/content/materials/${encodeURIComponent(id)}/signed-url`);
  return data.url;
}
