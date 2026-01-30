'use client';

import { useMemo, useState } from 'react';

type SearchResult = {
  id: number;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  scraped_at: string;
  rank: number;
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const arachneUrl = useMemo(() => {
    const envUrl = (process.env.NEXT_PUBLIC_SCRAPER_API_URL || '/api/arachne').trim();
    return envUrl.replace(/\/$/, '');
  }, []);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError('Please enter a search query.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('q', trimmed);
      if (domain.trim()) params.set('domain', domain.trim());

      const res = await fetch(`${arachneUrl}/memory/search?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Search failed with status ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search Memory</h1>
        <p className="text-gray-600 mt-1">
          Full-text search across scraped content (title, clean text, summaries).
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search scraped content..."
            className="flex-1 px-4 py-2 border rounded-lg"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Optional domain filter (e.g. example.com)"
          className="px-4 py-2 border rounded-lg"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      <div className="space-y-4">
        {results.length === 0 && !loading && !error && (
          <p className="text-gray-600">No results yet. Try a query like &quot;React hooks&quot;.</p>
        )}

        {results.map((result) => (
          <div key={result.id} className="p-4 border rounded-lg space-y-1">
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 font-semibold hover:underline"
            >
              {result.title || result.url}
            </a>
            <p className="text-sm text-gray-500">
              {result.domain} • {new Date(result.scraped_at).toLocaleString()}
            </p>
            <div
              className="mt-2 text-gray-800"
              dangerouslySetInnerHTML={{ __html: result.snippet || '' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

