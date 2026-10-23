'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState('');
  async function sync() {
    setState('Syncing…');
    const res = await fetch('/api/sync', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setState(res.ok ? '' : `Sync failed: ${data.error ?? res.status}`);
    router.refresh();
  }
  return (
    <>
      <button className="btn small ghost" onClick={sync} disabled={state === 'Syncing…'}>{state === 'Syncing…' ? 'Syncing…' : '↻ Sync now'}</button>
      {state && state !== 'Syncing…' && <span className="small" style={{ color: 'var(--danger)' }}>{state}</span>}
    </>
  );
}
