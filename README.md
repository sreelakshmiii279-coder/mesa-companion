# Mesa Companion

A phone app (installable PWA) for Term 2 at Mesa:

- **Today**: your classes from the portal and your own tasks on one timeline, with a live "you have 1h 40m until Gym" countdown.
- **Plan**: add tasks (once, daily or weekdays). You get a heads-up 15 min before each one, a "10 min left" warning, and "you're free for X, good slot for <assignment>" when a gap opens up. Unfinished tasks can be moved to tomorrow.
- **Due**: every portal assignment, with reminders 3 days, 1 day, 3 hours and 1 hour before. Tick one off to stop its reminders.
- **Notes**: Gemini watches each Term 2 class recording (YouTube) and writes study notes: key ideas, frameworks, examples, what the instructor stressed, self-test questions.
- **Alerts**: in-app feed of everything above, plus phone push notifications.

## How it runs

- Next.js on Vercel, Neon Postgres, Gemini Flash, Web Push (VAPID).
- `.github/workflows/cron.yml` calls `/api/cron` every 5 minutes (portal sync every 15 min, reminders) and `/api/cron/notes` twice an hour (one recording per call).
- While the app is open it also checks every minute, so reminders are on time.

## Setup

1. Copy `.env.example` to `.env.local` and fill it in. `npm run schema` creates the tables.
2. `npm run dev`, then `APP_URL=http://localhost:3000 npm run notes` writes notes for existing recordings.
3. On Vercel, add the same env vars. In GitHub repo secrets add `CRON_SECRET` and `APP_URL`.

## On your phone

- **Android (Chrome)**: open the link, menu → *Add to Home screen*, then Alerts → *Turn on notifications*.
- **iPhone (iOS 16.4+)**: open in Safari, Share → *Add to Home Screen*, open it from the Home Screen, then Alerts → *Turn on notifications*.
