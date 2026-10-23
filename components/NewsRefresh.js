'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Builds a fresh briefing in the background when the current one is stale, then reloads the page. */
export default function NewsRefresh({ stale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(stale);
  useEffect(() => {
    if (!stale) return;
    fetch('/api/news').finally(() => { setBusy(false); router.refresh(); });
  }, [stale, router]);
  return busy ? <p className="small muted">Fetching the latest headlines…</p> : null;
}
