import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';

export default async function Login({ searchParams }) {
  if (await isAuthed()) redirect('/');
  const { error } = await searchParams;
  return (
    <div style={{ maxWidth: 360, margin: '18vh auto 0' }}>
      <h1>Mesa Companion</h1>
      <p className="sub">Deadlines, class notes and your day planner.</p>
      <form action="/api/login" method="post" className="card stack">
        <label className="field">Password
          <input type="password" name="password" autoComplete="current-password" required autoFocus />
        </label>
        {error && <div className="small" style={{ color: 'var(--danger)' }}>Wrong password.</div>}
        <button className="btn block">Open</button>
      </form>
    </div>
  );
}
