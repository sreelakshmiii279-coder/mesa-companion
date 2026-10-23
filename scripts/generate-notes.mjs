// Writes notes for every recording that still needs them, one at a time, via the running app.
// Usage: npm run notes            (against http://localhost:3000)
//        APP_URL=https://… npm run notes
const base = process.env.APP_URL || 'http://localhost:3000';
for (;;) {
  const t = Date.now();
  const res = await fetch(`${base}/api/cron/notes`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const data = await res.json();
  console.log(res.status, data, `${Math.round((Date.now() - t) / 1000)}s`);
  if (!res.ok && res.status !== 500) process.exit(1);
  if (res.ok && !data.done) break;
}
