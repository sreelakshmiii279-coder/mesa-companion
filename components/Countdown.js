'use client';
import { useEffect, useState } from 'react';

function fmt(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** Live "1h 40m" until `to`; refreshes every 20 seconds. */
export default function Countdown({ to }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);
  return <>{fmt((new Date(to) - now) / 60_000)}</>;
}
