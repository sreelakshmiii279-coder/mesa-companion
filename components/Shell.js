'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Welcome from './Welcome';

const TABS = [
  { href: '/', label: 'Today', match: ['/'], d: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z' },
  { href: '/plan', label: 'Plan', match: ['/plan', '/chores', '/deadlines'], d: 'M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 8 2 2 4-4' },
  { href: '/learn', label: 'Learn', match: ['/learn', '/notes'], d: 'M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-14c-4 0-6.5.5-8 2zm0 0V20' },
  { href: '/news', label: 'News', match: ['/news'], d: 'M5 4h11a1 1 0 0 1 1 1v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zm12 5h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2M8 8h5m-5 4h5m-5 4h3' },
  { href: '/vision', label: 'Vision', match: ['/vision'], d: 'M12 3l2.2 5.6L20 9.3l-4.5 3.8 1.4 5.9L12 16l-4.9 3 1.4-5.9L4 9.3l5.8-.7z' },
];

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState([]);
  const lastId = useRef(0);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  // While the app is open: run reminders every minute and show anything new as a toast.
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch(`/api/tick?after=${lastId.current}`, { method: 'POST' });
        if (!res.ok || !alive) return;
        const data = await res.json();
        setUnread(data.unread);
        if (data.fresh.length) {
          setToasts((t) => [...t, ...data.fresh]);
          data.fresh.forEach((n) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 8000));
          router.refresh();
        }
        lastId.current = data.lastId;
      } catch {}
    }
    tick();
    const id = setInterval(tick, 60_000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [router]);

  return (
    <>
      <div className="aurora" aria-hidden="true"><span /><span /><span /></div>
      <Welcome />
      <div className="toasts">
        {toasts.map((t) => (
          <Link key={t.id} href={t.url || '/'} className="toast" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            <b>{t.title}</b>{t.body && <span>{t.body}</span>}
          </Link>
        ))}
      </div>
      <main className="page">
        <header className="topbar">
          <Link href="/" className="brand"><i />mesa</Link>
          <div className="top-icons">
            <Link href="/alerts" className="round" aria-label="Alerts">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zm4 3a2 2 0 0 0 4 0" /></svg>
              {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          </div>
        </header>
        {children}
      </main>
      <nav className="nav">
        {TABS.map((t) => {
          const active = t.match.some((m) => (m === '/' ? path === '/' : path.startsWith(m)));
          return (
            <Link key={t.href} href={t.href} className={active ? 'active' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
