'use client';
import { useEffect, useState } from 'react';

function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function PushSetup({ vapidKey }) {
  const [state, setState] = useState('checking'); // checking | ios-install | unsupported | off | on | denied | busy
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      if (ios && !standalone) return setState('ios-install');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setState('busy'); setError('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off');
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapidKey) });
      const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      if (!res.ok) throw new Error('Could not save this phone');
      setState('on');
    } catch (e) {
      setError(e.message); setState('off');
    }
  }

  if (state === 'checking') return null;
  return (
    <div className="card stack">
      {state === 'on' && <div><b>Phone notifications are on ✓</b><div className="muted small">Reminders reach this device even when the app is closed.</div></div>}
      {state === 'off' || state === 'busy' ? (
        <>
          <div><b>Get reminders on your phone</b><div className="muted small">Deadlines, class alerts and your planner, even when the app is closed.</div></div>
          <button className="btn block" onClick={enable} disabled={state === 'busy'}>{state === 'busy' ? 'Turning on…' : 'Turn on notifications'}</button>
        </>
      ) : null}
      {state === 'ios-install' && (
        <div><b>On iPhone, add this app to your Home Screen first</b>
          <div className="muted small">Tap the Share button in Safari → <b>Add to Home Screen</b>, open the app from there, then come back to this page to turn notifications on.</div></div>
      )}
      {state === 'denied' && <div><b>Notifications are blocked</b><div className="muted small">Allow notifications for this site in your phone's settings, then reload.</div></div>}
      {state === 'unsupported' && <div><b>This browser can't receive notifications</b><div className="muted small">Open the app in Chrome (Android) or add it to your Home Screen (iPhone).</div></div>}
      {error && <div className="small" style={{ color: 'var(--danger)' }}>{error}</div>}
    </div>
  );
}
