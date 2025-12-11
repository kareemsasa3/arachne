'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';

type Status = 'loading' | 'up' | 'down';

export default function ArachneStatus() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(apiUrl('/api/arachne-health'), { cache: 'no-store' });
        if (cancelled) return;
        setStatus(res.ok ? 'up' : 'down');
      } catch {
        if (!cancelled) setStatus('down');
      }
    };

    check();
    const id = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const tone =
    status === 'loading'
      ? 'bg-amber-100/80 text-amber-800 border-amber-200'
      : status === 'up'
        ? 'bg-green-100/80 text-green-800 border-green-200'
        : 'bg-red-100/80 text-red-800 border-red-200';

  const dot =
    status === 'loading'
      ? 'bg-amber-500'
      : status === 'up'
        ? 'bg-green-500'
        : 'bg-red-500';

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold shadow-sm ${tone}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${dot} animate-pulse`} />
      <span>
        Arachne: {status === 'loading' ? 'Checking…' : status === 'up' ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}

