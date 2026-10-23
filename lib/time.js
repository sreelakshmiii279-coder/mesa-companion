// Everything the user sees is in IST. Servers run in UTC, so convert explicitly.
export const IST_OFFSET_MIN = 330;
const MS = 60_000;

/** 'YYYY-MM-DD' of the IST calendar day containing `d`. */
export function istDay(d = new Date()) {
  return new Date(new Date(d).getTime() + IST_OFFSET_MIN * MS).toISOString().slice(0, 10);
}

/** 'HH:MM' IST wall-clock time of `d`. */
export function istHHMM(d = new Date()) {
  return new Date(new Date(d).getTime() + IST_OFFSET_MIN * MS).toISOString().slice(11, 16);
}

/** UTC Date for an IST wall-clock time on an IST day. */
export function istToDate(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, dd] = day.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, dd, h, m) - IST_OFFSET_MIN * MS);
}

export function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for an IST day string. */
export function weekday(day) {
  return new Date(day + 'T00:00:00Z').getUTCDay();
}

export function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
}

export function fmtDay(d) {
  return new Date(d).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
  });
}

/** "1h 40m", "25m" */
export function fmtDuration(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** "in 2 days", "in 5h", "3h ago" */
export function fmtRelative(d, now = new Date()) {
  const min = (new Date(d) - now) / MS;
  const abs = Math.abs(min);
  const s = abs < 60 ? fmtDuration(abs) : abs < 48 * 60 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)} days`;
  return min >= 0 ? `in ${s}` : `${s} ago`;
}
