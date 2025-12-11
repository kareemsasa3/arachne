'use client';

import { useEffect, useState } from 'react';

type Failure = {
  url: string;
  domain: string;
  status_code: number;
  scrape_status: string;
  error: string;
  retry_count: number;
  failed_at: string;
};

export default function FailuresPage() {
  const [failures, setFailures] = useState<Failure[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFailures = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SCRAPER_API_URL}/memory/failures?limit=50`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const data = await res.json();
        setFailures(data.failures ?? []);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load failures');
        console.error(err);
      }
    };

    fetchFailures();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Failed Scrapes</h1>
      <p className="text-gray-600 mb-4">
        Recent failed scrape attempts are stored to help avoid retry loops and debug blocking patterns.
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {failures.map((f, i) => (
          <div key={i} className="rounded-lg border bg-red-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <a href={f.url} className="font-semibold text-blue-600 hover:underline">
                  {f.url}
                </a>
                <p className="text-sm text-gray-500">{f.domain}</p>
              </div>
              <span className="rounded bg-red-200 px-2 py-1 text-xs font-semibold text-red-800">
                {f.scrape_status}
              </span>
            </div>

            <div className="mt-2 text-sm text-gray-700">
              <p>
                <strong>Status Code:</strong> {f.status_code} &nbsp;|&nbsp; <strong>Retries:</strong>{' '}
                {f.retry_count}
              </p>
              {f.error && <p className="mt-1 text-gray-600">{f.error}</p>}
              <p className="mt-1 text-xs text-gray-500">
                Failed: {new Date(f.failed_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}

        {failures.length === 0 && !error && (
          <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No recent failures recorded.
          </div>
        )}
      </div>
    </div>
  );
}

