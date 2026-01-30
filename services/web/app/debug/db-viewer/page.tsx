'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import { apiUrl } from '@/lib/api';

type SnapshotLite = {
  id: string;
  url: string;
  domain: string;
  title: string;
  content_hash: string;
  summary?: string;
  change_summary?: string;
  scraped_at: string;
  last_checked_at: string;
  status_code: number;
  has_changes?: boolean;
};

type SnapshotDetail = SnapshotLite & {
  clean_text?: string;
  raw_content?: string;
  previous_hash?: string;
};

type ListResponse = {
  snapshots: SnapshotLite[];
  total: number;
  limit: number;
  offset: number;
};

type Diagnostic = {
  type: 'error' | 'warn' | 'info';
  message: string;
};

const BACKEND_BASE = (process.env.NEXT_PUBLIC_SCRAPER_API_URL || '/api/arachne')
  .trim()
  .replace(/\/$/, '');

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'div',
  'span',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'blockquote',
  'code',
  'pre',
  'section',
  'article',
  'header',
  'footer',
  'nav',
  'main',
  'aside',
  'figure',
  'figcaption',
  'b',
  'i',
  'small',
  'sub',
  'sup',
  'mark',
  'del',
  'ins',
  'hr',
  'video',
  'source',
  'picture',
];

const ALLOWED_ATTRS = [
  'href',
  'src',
  'srcset',
  'sizes',
  'alt',
  'title',
  'class',
  'id',
  'target',
  'rel',
  'style',
  'width',
  'height',
  'colspan',
  'rowspan',
  'aria-label',
  'aria-hidden',
  'role',
];

const sanitizeHTML = (html: string) => {
  let toSanitize = html || '';
  const bodyMatch = toSanitize.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    toSanitize = bodyMatch[1];
  }

  const removedTags = new Set<string>();
  const removedAttrs = new Set<string>();

  const purifier = DOMPurify as unknown as {
    addHook: (hook: string, cb: (node: Element, data: any) => void) => void;
    removeHook: (hook: string, cb: (node: Element, data: any) => void) => void;
    sanitize: typeof DOMPurify.sanitize;
  };

  const elementHook = (_node: Element, data: any) => {
    if (!data.allowed) {
      removedTags.add(data.tagName.toLowerCase());
    }
  };

  const attrHook = (node: Element, data: any) => {
    if (!data.keepAttr) {
      const tag = node?.nodeName?.toLowerCase() || 'unknown';
      removedAttrs.add(`${data.attrName.toLowerCase()}@${tag}`);
    }
  };

  const elementHookName = 'uponSanitizeElement';
  const attrHookName = 'uponSanitizeAttribute';

  purifier.addHook(elementHookName, elementHook);
  purifier.addHook(attrHookName, attrHook);

  const clean = purifier.sanitize(toSanitize, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|data:image\/(?:png|jpe?g|gif|webp|svg\+xml));|\/|#)/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
  });

  purifier.removeHook(elementHookName, elementHook);
  purifier.removeHook(attrHookName, attrHook);

  console.info('[Sanitizer] Preview stats', {
    originalLength: toSanitize.length,
    sanitizedLength: clean.length,
    removedTags: Array.from(removedTags).sort(),
    removedAttributes: Array.from(removedAttrs).sort(),
  });

  return clean;
};

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();

export default function DatabaseViewerPage() {
  const [entries, setEntries] = useState<SnapshotLite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<SnapshotDetail | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIframe, setShowIframe] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setIsListLoading(true);
      setError(null);
      const res = await fetch(`${BACKEND_BASE}/memory/recent?limit=200&offset=0`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Failed to load snapshots (${res.status})`);
      }
      const data: ListResponse = await res.json();
      setEntries(data.snapshots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setIsListLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      setIsDetailLoading(true);
      setError(null);
      const res = await fetch(`${BACKEND_BASE}/memory/version/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load snapshot ${id}`);
      }
      const data = await res.json();
      setSelectedDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshot details');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries
      .filter((entry) => {
        const matchesSearch =
          term.length === 0 ||
          entry.url.toLowerCase().includes(term) ||
          (entry.title || '').toLowerCase().includes(term) ||
          (entry.summary || '').toLowerCase().includes(term);
        const matchesStatus =
          statusFilter === 'all'
            ? true
            : statusFilter === 'success'
              ? entry.status_code >= 200 && entry.status_code < 400
              : entry.status_code >= 400;
        return matchesSearch && matchesStatus;
      })
      .sort(
        (a, b) =>
          new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime(),
      );
  }, [entries, search, statusFilter]);

  const stats = useMemo(() => {
    const total = entries.length;
    const success = entries.filter((e) => e.status_code >= 200 && e.status_code < 400).length;
    const failed = entries.filter((e) => e.status_code >= 400).length;
    return { total, success, failed };
  }, [entries]);

  const previewHtml = useMemo(() => {
    if (!selectedDetail) return '';
    const base = selectedDetail.raw_content || selectedDetail.clean_text || '';
    return sanitizeHTML(base);
  }, [selectedDetail]);

  const previewText = useMemo(() => stripHtml(previewHtml), [previewHtml]);
  const rawLength = selectedDetail?.raw_content?.length || 0;
  const sanitizedLength = previewHtml.length;

  const diagnostics: Diagnostic[] = useMemo(() => {
    if (!selectedDetail) return [];
    const issues: Diagnostic[] = [];
    const raw = selectedDetail.raw_content || '';
    const clean = selectedDetail.clean_text || '';
    const missingRaw = !raw.trim();
    const missingClean = !clean.trim();

    if (missingRaw) issues.push({ type: 'error', message: 'Missing raw_content; nothing to render.' });
    if (missingClean) issues.push({ type: 'warn', message: 'Missing clean_text; no extracted text available.' });
    if (!missingRaw && raw.length < 200) {
      issues.push({ type: 'warn', message: 'Raw HTML is very short (<200 chars); may be empty page or blocked.' });
    }
    if (raw.includes('\ufffd')) {
      issues.push({ type: 'warn', message: 'Contains replacement characters (�); possible encoding issue.' });
    }
    if (!missingRaw && !/<body[\s>]/i.test(raw)) {
      issues.push({ type: 'warn', message: 'No <body> tag detected; HTML may be partial.' });
    }
    if (!missingRaw && sanitizedLength === 0) {
      issues.push({ type: 'error', message: 'Sanitization removed all content; preview would be blank.' });
    }
    if (previewText.length < 50 && rawLength > 0) {
      issues.push({ type: 'warn', message: 'Rendered text is very short; preview may look empty.' });
    }
    const scriptCount = (raw.match(/<script/gi) || []).length;
    if (scriptCount > 5) {
      issues.push({ type: 'info', message: 'Heavy script usage; content might be JS-rendered.' });
    }
    return issues;
  }, [selectedDetail, previewText.length, rawLength, sanitizedLength]);

  const handleSelect = (entry: SnapshotLite) => {
    setSelectedId(entry.id);
    setSelectedDetail(null);
    setShowIframe(false);
    fetchDetail(entry.id);
  };

  const handleRescrape = async (url: string) => {
    try {
      const res = await fetch(apiUrl('/api/arachne/scrape'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url] }),
      });
      if (!res.ok) throw new Error('Failed to start re-scrape');
      const data = await res.json();
      alert(`Re-scraping started\nJob ID: ${data.jobId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start re-scrape');
    }
  };

  const handleExport = () => {
    if (!selectedDetail) return;
    const blob = new Blob([JSON.stringify(selectedDetail, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot-${selectedDetail.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyRaw = async () => {
    if (!selectedDetail?.raw_content) return;
    try {
      await navigator.clipboard.writeText(selectedDetail.raw_content);
      alert('Raw HTML copied to clipboard');
    } catch {
      alert('Failed to copy');
    }
  };

  const statusTone = (code: number) => {
    if (code >= 200 && code < 300) return 'bg-green-100 text-green-800';
    if (code >= 300 && code < 400) return 'bg-blue-100 text-blue-800';
    if (code >= 400 && code < 500) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const panelClass =
    'rounded-lg border border-white/10 bg-white/5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm';

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Debug / Data</p>
            <h1 className="text-2xl font-semibold">Database Viewer</h1>
            <p className="text-sm text-slate-300">
              Inspect stored snapshots to diagnose why previews might render blank.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className={panelClass + ' p-4'}>
            <p className="text-xs text-slate-400">Total entries</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
            <p className="text-xs text-green-200">Success</p>
            <p className="text-2xl font-semibold text-green-100">{stats.success}</p>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
            <p className="text-xs text-red-200">Failed</p>
            <p className="text-2xl font-semibold text-red-100">{stats.failed}</p>
          </div>
        </div>

        <div className={panelClass + ' p-4'}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search URL, title, or summary"
                className="w-full min-w-[240px] flex-1 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              >
                <option value="all">All statuses</option>
                <option value="success">2xx-3xx</option>
                <option value="error">4xx-5xx</option>
              </select>
              <button
                onClick={fetchList}
                className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"
              >
                Refresh
              </button>
            </div>
            <div className="text-xs text-slate-400">Showing {filteredEntries.length} entries</div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-white/10 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
            <div className="max-h-[320px] overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase text-slate-300">
                  <tr>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Scraped</th>
                    <th className="px-4 py-3">Last Checked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isListLoading && (
                    <tr>
                      <td className="px-4 py-4 text-slate-400" colSpan={5}>
                        Loading entries...
                      </td>
                    </tr>
                  )}
                  {!isListLoading && filteredEntries.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-slate-400" colSpan={5}>
                        No entries found.
                      </td>
                    </tr>
                  )}
                  {!isListLoading &&
                    filteredEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`cursor-pointer hover:bg-white/5 ${
                          selectedId === entry.id ? 'bg-blue-500/10' : ''
                        }`}
                        onClick={() => handleSelect(entry)}
                      >
                        <td className="max-w-[260px] truncate px-4 py-3 font-medium text-white">
                          {entry.url}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-200">
                          {entry.title || 'Untitled'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(entry.status_code)}`}>
                            {entry.status_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {new Date(entry.scraped_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {new Date(entry.last_checked_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className={panelClass + ' p-4'}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Entry details</h2>
              <p className="text-sm text-slate-300">Select an entry to inspect content and diagnostics.</p>
            </div>
            {selectedDetail?.url && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleRescrape(selectedDetail.url)}
                  className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                >
                  Re-scrape URL
                </button>
                <button
                  onClick={copyRaw}
                  className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                >
                  Copy Raw HTML
                </button>
                <button
                  onClick={handleExport}
                  className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => setShowIframe((v) => !v)}
                  className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                >
                  {showIframe ? 'Hide iframe' : 'View in iframe'}
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            {isDetailLoading && <p className="text-sm text-slate-400">Loading snapshot...</p>}
            {!isDetailLoading && !selectedDetail && (
              <p className="text-sm text-slate-400">No entry selected.</p>
            )}

            {selectedDetail && (
              <div className="space-y-4">
                <div className={panelClass + ' p-4'}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-400">URL</p>
                      <p className="truncate text-lg font-semibold text-white">{selectedDetail.url}</p>
                      <p className="text-sm text-slate-300">{selectedDetail.title || 'Untitled'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(selectedDetail.status_code)}`}>
                        {selectedDetail.status_code}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                        Hash: {selectedDetail.content_hash.slice(0, 10)}…
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm text-slate-300">
                    <div>Scraped: {new Date(selectedDetail.scraped_at).toLocaleString()}</div>
                    <div>Last checked: {new Date(selectedDetail.last_checked_at).toLocaleString()}</div>
                    <div>Content length: {rawLength.toLocaleString()} chars</div>
                  </div>
                </div>

                <div className={panelClass + ' p-4'}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Diagnostics</h3>
                    <span className="text-xs text-slate-400">
                      Sanitized length: {sanitizedLength.toLocaleString()} ({rawLength
                        ? `${Math.max(0, rawLength - sanitizedLength)} removed`
                        : 'n/a'})
                    </span>
                  </div>
                  {diagnostics.length === 0 ? (
                    <p className="text-sm text-green-200">No obvious issues detected.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {diagnostics.map((d, idx) => (
                        <span
                          key={idx}
                          className={`rounded-full px-3 py-1 text-xs ${
                            d.type === 'error'
                              ? 'bg-red-500/20 text-red-100'
                              : d.type === 'warn'
                                ? 'bg-yellow-500/20 text-yellow-100'
                                : 'bg-blue-500/20 text-blue-100'
                          }`}
                        >
                          {d.message}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={panelClass + ' p-4 bg-slate-950'}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Raw HTML (stored)</h3>
                      <span className="text-xs text-slate-400">{rawLength.toLocaleString()} chars</span>
                    </div>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-slate-900 p-3 text-xs text-slate-100">
{selectedDetail.raw_content || 'No raw_content stored.'}
                    </pre>
                  </div>

                  <div className={`${panelClass} bg-white p-4`}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Preview (sanitized)</h3>
                      <span className="text-xs text-gray-600">{sanitizedLength.toLocaleString()} chars</span>
                    </div>
                    <div className="max-h-96 overflow-auto rounded-md border border-gray-200 bg-white p-3">
                      <div
                        className="prose prose-sm max-w-none text-gray-900 [&_*]:!text-gray-900"
                        dangerouslySetInnerHTML={{ __html: previewHtml || '<em>No preview available</em>' }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      This is what the Preview pane sees after sanitization (same rules as the job result preview).
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Extracted text / cleaned HTML</h3>
                      <span className="text-xs text-slate-400">
                        {(selectedDetail.clean_text || '').length.toLocaleString()} chars
                      </span>
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-slate-900/60 p-3 text-xs text-slate-100">
{selectedDetail.clean_text || 'No clean_text stored.'}
                    </pre>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Diff summary</h3>
                      <span className="text-xs text-slate-400">Preview vs stored</span>
                    </div>
                    <div className="space-y-2 text-sm text-slate-200">
                      <div className="flex justify-between">
                        <span>Raw length</span>
                        <span>{rawLength.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sanitized length</span>
                        <span>{sanitizedLength.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Removed by sanitizer</span>
                        <span>
                          {rawLength > 0
                            ? `${Math.max(0, rawLength - sanitizedLength).toLocaleString()} (${Math.round(
                                ((rawLength - sanitizedLength) / rawLength) * 100,
                              )}%)
                              `
                            : 'n/a'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rendered text length</span>
                        <span>{previewText.length.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Use this to see whether sanitization is stripping everything and causing blank previews.
                      </p>
                    </div>
                  </div>
                </div>

                {showIframe && selectedDetail?.raw_content && (
                  <div className={`${panelClass} bg-white p-4`}>
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">Iframe render</h3>
                    <iframe
                      title="raw-preview"
                      srcDoc={selectedDetail.raw_content}
                      className="h-[480px] w-full rounded-md border border-gray-200"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

