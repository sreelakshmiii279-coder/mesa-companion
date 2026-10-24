'use client';
// On open: the morning screen (first open of the day, before noon), then a news pop-up for any briefing not yet seen.
import { useEffect, useState } from 'react';
import Link from 'next/link';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const istNow = () => new Date(Date.now() + 330 * 60_000);
const istToday = () => istNow().toISOString().slice(0, 10);

export default function Welcome() {
  const [morning, setMorning] = useState(null);
  const [news, setNews] = useState(null);
  const [step, setStep] = useState('idle'); // idle | morning | news | done

  useEffect(() => {
    const hour = istNow().getUTCHours();
    const forced = new URLSearchParams(location.search).has('morning');
    const wantMorning = forced || (hour >= 4 && hour < 12 && store.get('morning-seen') !== istToday());
    const newsReq = fetch('/api/news').then((r) => r.json()).catch(() => null);
    if (wantMorning) {
      fetch('/api/morning').then((r) => r.json()).then((d) => { if (d.message) { setMorning(d); setStep('morning'); } }).catch(() => {});
    }
    newsReq.then((n) => {
      if (n?.items?.length && String(n.id) !== store.get('news-seen')) {
        setNews(n);
        setStep((s) => (s === 'idle' ? 'news' : s));
      }
    });
  }, []);

  function closeMorning() {
    store.set('morning-seen', istToday());
    setStep(news ? 'news' : 'done');
  }
  function closeNews() {
    if (news) store.set('news-seen', String(news.id));
    setStep('done');
  }

  if (step === 'morning' && morning) {
    const { message: m, vision } = morning;
    const future = vision.find((v) => v.kind === 'future');
    const hello = istNow().getUTCHours() < 12 ? 'Good morning' : 'Hey';
    return (
      <div className="morning" role="dialog" aria-label="Morning">
        <div className="inner">
          <div className="hello">{hello} ☀️ {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div className="aff">{m.affirmation}</div>
          <div className="glass"><div className="k">From future you</div>{m.futureSelf}</div>
          {future && <div className="glass"><div className="k">Who I'm becoming</div>{future.text}</div>}
          <div className="glass"><div className="k">Today's one thing</div>{m.focus}</div>
          <button className="go" onClick={closeMorning}>Let's go →</button>
        </div>
      </div>
    );
  }

  if (step === 'news' && news) {
    return (
      <div className="overlay" onClick={closeNews}>
        <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="News briefing">
          <div className="grabber" />
          <div className="row between">
            <div>
              <div className="small muted">{new Date(news.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} briefing</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>What's happening</div>
            </div>
            <button className="btn small ghost" onClick={closeNews}>Close</button>
          </div>
          <div className="stack" style={{ marginTop: 14 }}>
            {news.items.slice(0, 4).map((s, i) => (
              <div key={i} className="card story">
                <div className="cat">{s.category}</div>
                <div className="h">{s.headline}</div>
                <div className="small muted">{s.summary}</div>
              </div>
            ))}
          </div>
          <Link href="/news" className="btn block" style={{ marginTop: 14 }} onClick={closeNews}>Read the full briefing</Link>
        </div>
      </div>
    );
  }
  return null;
}
