'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Trash2 } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import GlassModal from '@/components/GlassModal';
import { apiUrl } from '@/lib/api';

type HistoryEntry = {
  id: string;
  url: string;
  domain: string;
  title: string;
  content_hash: string;
  previous_hash?: string;
  has_changes: boolean;
  change_summary?: string;
  summary?: string;
  scraped_at: string;
  last_checked_at: string;
  status_code: number;
};

type DiffResult = {
  url: string;
  from_id: string;
  to_id: string;
  from_timestamp: string;
  to_timestamp: string;
  from_hash: string;
  to_hash: string;
  diff: string;
  lines_added: number;
  lines_removed: number;
};

type VersionDetail = {
  id: string;
  url: string;
  domain: string;
  title: string;
  content_hash: string;
  previous_hash?: string;
  has_changes: boolean;
  summary?: string;
  change_summary?: string;
  clean_text?: string;
  raw_content?: string;
  scraped_at: string;
  last_checked_at: string;
  status_code: number;
};

const apiBase = process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://localhost:8080';

const renderDiffLines = (diff: string) => {
  const lines = diff.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line || ' ';
    let color = 'text-gray-800';
    if (trimmed.startsWith('+')) {
      color = 'text-green-700';
    } else if (trimmed.startsWith('-')) {
      color = 'text-red-700';
    } else if (trimmed.startsWith('@@')) {
      color = 'text-indigo-700';
    }

    return (
      <div key={`${idx}-${trimmed.slice(0, 8)}`} className={`whitespace-pre-wrap font-mono text-[13px] ${color}`}>
        {trimmed}
      </div>
    );
  });
};

export default function HistoryDetailPage() {
  const { encodedUrl } = useParams<{ encodedUrl: string }>();
  const router = useRouter();
  const decodedUrl = useMemo(() => decodeURIComponent(encodedUrl || ''), [encodedUrl]);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<Record<string, { loading: boolean; data?: DiffResult; error?: string }>>({});
  const [analyses, setAnalyses] = useState<Record<string, { loading: boolean; text?: string; error?: string }>>({});
  const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [failedSaveIds, setFailedSaveIds] = useState<Record<string, boolean>>({});
  const [versionViewMode, setVersionViewMode] = useState<'text' | 'preview'>('text');
  const panelClass =
    'rounded-lg border border-white/10 bg-white/5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm';

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/memory/history?url=${encodeURIComponent(decodedUrl)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`Failed to load history (${res.status})`);
        }
        const data: HistoryEntry[] = await res.json();
        setHistory(data || []);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setIsLoading(false);
      }
    };

    if (decodedUrl) {
      fetchHistory();
    }
  }, [decodedUrl]);

  const fetchDiff = async (entryId: string) => {
    const currentIdx = history.findIndex((h) => h.id === entryId);
    if (currentIdx === -1 || currentIdx === history.length - 1) {
      setDiffs((prev) => ({
        ...prev,
        [entryId]: { loading: false, error: 'No previous version to diff' },
      }));
      return;
    }

    const from = history[currentIdx];
    const to = history[currentIdx + 1]; // previous version in time

    setDiffs((prev) => ({ ...prev, [entryId]: { loading: true } }));
    try {
      const res = await fetch(
        `${apiBase}/memory/diff?url=${encodeURIComponent(decodedUrl)}&from=${encodeURIComponent(
          from.scraped_at,
        )}&to=${encodeURIComponent(to.scraped_at)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch diff (${res.status})`);
      }
      const data: DiffResult = await res.json();
      setDiffs((prev) => ({ ...prev, [entryId]: { loading: false, data: data } }));
    } catch (err) {
      setDiffs((prev) => ({
        ...prev,
        [entryId]: { loading: false, error: err instanceof Error ? err.message : 'Failed to load diff' },
      }));
    }
  };

  const fetchVersion = async (id: string) => {
    setIsDetailLoading(true);
    setSelectedVersion(null);
    try {
      const res = await fetch(`${apiBase}/memory/version/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load version (${res.status})`);
      }
      const data: VersionDetail = await res.json();
      setSelectedVersion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const analyzeChanges = async (entryId: string) => {
    const currentIdx = history.findIndex((h) => h.id === entryId);
    const previous = history[currentIdx + 1];
    if (!previous) {
      setAnalyses((prev) => ({ ...prev, [entryId]: { loading: false, error: 'No previous version to analyze' } }));
      return;
    }

    setAnalyses((prev) => ({ ...prev, [entryId]: { loading: true, text: '' } }));
    // Clear any existing error before retry
    setHistory((prev) =>
      prev.map((h, idx) =>
        idx === currentIdx
          ? {
              ...h,
              change_summary: h.change_summary?.startsWith('Error:') ? '' : h.change_summary,
            }
          : h,
      ),
    );
    try {
      const res = await fetch(`${apiBase}/memory/analyze-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: decodedUrl,
          from_timestamp: previous.scraped_at,
          to_timestamp: history[currentIdx].scraped_at,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value || new Uint8Array(), { stream: true });
        fullText += chunk;
        setAnalyses((prev) => ({ ...prev, [entryId]: { loading: true, text: fullText } }));
      }

      setAnalyses((prev) => ({ ...prev, [entryId]: { loading: false, text: fullText } }));
      setHistory((prev) =>
        prev.map((h, idx) =>
          idx === currentIdx
            ? {
                ...h,
                change_summary: fullText,
              }
            : h,
        ),
      );
    } catch (err) {
      setAnalyses((prev) => ({
        ...prev,
        [entryId]: { loading: false, error: err instanceof Error ? err.message : 'Failed to analyze changes' },
      }));
    }
  };

  const saveSummary = async (entryId: string, summary: string) => {
    setSavingIds((prev) => ({ ...prev, [entryId]: true }));
    try {
      const token = process.env.NEXT_PUBLIC_SCRAPER_API_TOKEN;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch(`${apiBase}/memory/snapshot/${entryId}/summary`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ summary }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || `Save failed (${resp.status})`);
      }
      setFailedSaveIds((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    } finally {
      setSavingIds((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    }
  };

  const generateSummary = async (entry: HistoryEntry | VersionDetail) => {
    if (generatingIds[entry.id]) return;
    setGeneratingIds((prev) => ({ ...prev, [entry.id]: true }));
    try {
      // Load full version content
      let versionData: VersionDetail | null = null;
      if (selectedVersion && selectedVersion.id === entry.id && (selectedVersion.clean_text || selectedVersion.raw_content)) {
        versionData = selectedVersion;
      } else {
        const res = await fetch(`${apiBase}/memory/version/${entry.id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load version (${res.status})`);
        versionData = await res.json();
      }

      const content =
        versionData?.clean_text ||
        versionData?.raw_content ||
        '';
      if (!content) throw new Error('No content available to summarize');

      const aiResp = await fetch(apiUrl('/api/ai/summarize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          url: entry.url,
          title: entry.title || '',
        }),
      });
      if (!aiResp.ok) {
        const err = await aiResp.json().catch(() => ({}));
        throw new Error(err.error || `AI summarize failed (${aiResp.status})`);
      }
      const aiData = await aiResp.json();
      const newSummary = aiData.summary || '';
      if (!newSummary) throw new Error('Empty summary returned');

      setHistory((prev) =>
        prev.map((h) => (h.id === entry.id ? { ...h, summary: newSummary } : h))
      );
      if (selectedVersion && selectedVersion.id === entry.id) {
        setSelectedVersion({ ...selectedVersion, summary: newSummary });
      }

      try {
        await saveSummary(entry.id, newSummary);
      } catch (err) {
        console.error('Save summary failed', err);
        setFailedSaveIds((prev) => ({ ...prev, [entry.id]: true }));
        alert(err instanceof Error ? err.message : 'Failed to save summary to memory');
      }
    } catch (err) {
      console.error('Generate summary failed', err);
      alert(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setGeneratingIds((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    }
  };

  useEffect(() => {
    if (selectedVersion) {
      setVersionViewMode('text');
    }
  }, [selectedVersion]);

  const sanitizeHTML = (html: string) => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
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
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
      ALLOW_DATA_ATTR: false,
    });
  };

  const deleteVersion = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to delete this version?')) return;
    setDeletingId(entryId);
    try {
      const res = await fetch(`${apiBase}/memory/version/${entryId}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Failed to delete (status ${res.status})`);
      }
      setHistory((prev) => {
        const updated = prev.filter((h) => h.id !== entryId);
        if (updated.length <= 1) {
          router.push('/history');
        }
        if (selectedVersion?.id === entryId) {
          setSelectedVersion(null);
        }
        return updated;
      });
    } catch (err) {
      console.error('Delete failed', err);
      alert(err instanceof Error ? err.message : 'Failed to delete version');
    } finally {
      setDeletingId(null);
    }
  };

  const copyURL = async () => {
    try {
      await navigator.clipboard.writeText(decodedUrl);
    } catch (err) {
      console.error('Failed to copy URL', err);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className={`${panelClass} p-4 md:p-6 flex items-center justify-between`}>
          <div>
            <button
              onClick={() => router.back()}
              className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-2 text-sm font-medium"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold mt-2 text-white">Version History</h1>
            <p className="text-white/80 break-all text-sm mt-2">{decodedUrl}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-white/60">{history.length} versions</span>
              <button
                onClick={copyURL}
                className="text-xs text-blue-200 hover:text-blue-100 font-medium"
              >
                Copy URL
              </button>
            </div>
          </div>
          <Link
            href="/history"
            className="text-sm text-blue-200 hover:text-blue-100 font-medium"
          >
            Browse all
          </Link>
        </div>

        {isLoading && (
          <div className={`${panelClass} p-6 flex items-center gap-3 text-white/80`}>
            <svg className="animate-spin h-5 w-5 text-blue-300" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading history...
          </div>
        )}

        {error && !isLoading && (
          <div className={`${panelClass} p-6 bg-red-500/10 border-red-200/50`}>
            <h2 className="text-lg font-semibold text-red-100 mb-2">Failed to load history</h2>
            <p className="text-red-100">{error}</p>
          </div>
        )}

        {!isLoading && !error && history.length === 0 && (
          <div className={`${panelClass} p-8 text-center`}>
            <h2 className="text-xl font-semibold text-white">No versions yet</h2>
            <p className="text-white/80 mt-2">Scrape this URL to start building history.</p>
          </div>
        )}

        {!isLoading && !error && history.length > 0 && (
          <div className="space-y-3">
            {history.map((entry, idx) => {
              const previous = history[idx + 1];
              const diffState = diffs[entry.id];
              const hasPrevious = Boolean(previous);
              const analysisState = analyses[entry.id];
              return (
                <div key={entry.id} className={`${panelClass} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/60">v{history.length - idx}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            entry.has_changes ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {entry.has_changes ? 'Changed' : 'No change'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            entry.status_code >= 200 && entry.status_code < 300
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {entry.status_code}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mt-1">
                        {entry.title || 'No title'}
                      </h3>
                      <p className="text-sm text-white/80 mt-1">
                        {new Date(entry.scraped_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-white/60 mt-1 font-mono break-all">
                        hash {entry.content_hash.slice(0, 12)}...
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <button
                        onClick={() => fetchVersion(entry.id)}
                        className="text-sm text-blue-200 hover:text-blue-100 font-medium"
                      >
                        View version
                      </button>
                      <button
                        onClick={() => fetchDiff(entry.id)}
                        disabled={!hasPrevious}
                        className={`text-sm font-medium inline-flex items-center gap-1 ${
                          hasPrevious
                            ? 'text-purple-200 hover:text-purple-100'
                            : 'text-white/30 cursor-not-allowed'
                        }`}
                      >
                        {hasPrevious ? 'Diff vs previous' : 'No previous version'}
                      </button>
                      {hasPrevious &&
                        entry.has_changes &&
                        (!entry.change_summary || entry.change_summary.startsWith('Error:')) && (
                        <button
                          onClick={() => analyzeChanges(entry.id)}
                          disabled={analysisState?.loading}
                          className={`text-sm font-medium inline-flex items-center gap-1 ${
                            analysisState?.loading
                              ? 'text-white/40 cursor-not-allowed'
                              : 'text-purple-200 hover:text-purple-100'
                          }`}
                        >
                          {analysisState?.loading
                            ? 'Analyzing…'
                            : entry.change_summary?.startsWith('Error:')
                              ? 'Retry analysis'
                              : 'Analyze changes'}
                        </button>
                      )}
                      <button
                        onClick={() => deleteVersion(entry.id)}
                        disabled={deletingId === entry.id}
                        className={`text-sm font-medium inline-flex items-center gap-1 ${
                          deletingId === entry.id
                            ? 'text-red-300 cursor-not-allowed'
                            : 'text-red-300 hover:text-red-200'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingId === entry.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  {(entry.change_summary || analysisState?.text || analysisState?.error) && (
                    <div className="mt-3 bg-purple-500/10 border border-purple-200/40 rounded-lg p-3 text-sm text-white/90 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
                      <div className="font-medium text-purple-100 mb-1">Change summary:</div>
                      {entry.change_summary && (
                        <div className="prose prose-sm text-white/90">
                          <ReactMarkdown>{entry.change_summary}</ReactMarkdown>
                        </div>
                      )}
                      {!entry.change_summary && analysisState?.text && (
                        <div className="prose prose-sm text-white/90 whitespace-pre-wrap">
                          {analysisState.text}
                        </div>
                      )}
                      {analysisState?.error && (
                        <div className="text-sm text-red-300">{analysisState.error}</div>
                      )}
                    </div>
                  )}

                  {entry.summary ? (
                    <div className="mt-3 bg-blue-500/10 border border-blue-200/40 rounded-lg p-3 text-sm text-white/90 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
                      <div className="font-medium text-blue-100 mb-1">Summary:</div>
                      <div className="prose prose-sm text-white/90">
                        <ReactMarkdown>{entry.summary}</ReactMarkdown>
                      </div>
                      {failedSaveIds[entry.id] && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-200">
                          <span>Save to memory failed.</span>
                          <button
                            onClick={() => saveSummary(entry.id, entry.summary || '')}
                            disabled={savingIds[entry.id]}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 border border-red-300/30 text-red-100 disabled:opacity-60"
                          >
                            {savingIds[entry.id] ? 'Retrying…' : 'Retry save'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <button
                        onClick={() => generateSummary(entry)}
                        disabled={generatingIds[entry.id]}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 rounded-lg transition-colors text-sm font-medium border border-blue-300/30 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {generatingIds[entry.id] ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-blue-200" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating summary…
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Generate summary
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {diffState && (
                    <div className="mt-3 border border-white/10 rounded-lg p-3 bg-white/5 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
                      {diffState.loading && (
                        <div className="text-sm text-white/80 flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-blue-300" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Loading diff...
                        </div>
                      )}
                      {diffState.error && (
                        <p className="text-sm text-red-300">{diffState.error}</p>
                      )}
                      {diffState.data && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 text-xs text-white/70">
                            <span className="font-mono bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                              +{diffState.data.lines_added} / -{diffState.data.lines_removed}
                            </span>
                            <span className="text-white/60">
                              {new Date(diffState.data.from_timestamp).toLocaleString()} →{' '}
                              {new Date(diffState.data.to_timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="bg-slate-900/40 border border-slate-200/20 rounded p-3 overflow-x-auto">
                            <div className="space-y-0.5">{renderDiffLines(diffState.data.diff)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Version detail modal */}
      <GlassModal
        open={Boolean(selectedVersion)}
        onClose={() => setSelectedVersion(null)}
        title={selectedVersion ? `Version ${selectedVersion.id}` : undefined}
        subtitle={selectedVersion?.url}
        footer={
          selectedVersion && (
            <>
              <button
                onClick={() => setSelectedVersion(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-white/10 border border-white/20 rounded hover:bg-white/20"
              >
                Close
              </button>
            </>
          )
        }
      >
        {selectedVersion && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="text-white/70">Title:</span> <span className="text-white">{selectedVersion.title || 'No title'}</span></div>
                <div><span className="text-white/70">Domain:</span> <span className="text-white">{selectedVersion.domain}</span></div>
                <div><span className="text-white/70">Status:</span> <span className="text-white">{selectedVersion.status_code}</span></div>
                <div><span className="text-white/70">Scraped:</span> <span className="text-white">{new Date(selectedVersion.scraped_at).toLocaleString()}</span></div>
                <div className="md:col-span-2">
                  <span className="text-white/70">Hash:</span>{' '}
                  <span className="text-white font-mono break-all">{selectedVersion.content_hash}</span>
                </div>
              </div>

              {selectedVersion.summary ? (
                <div className="bg-blue-500/10 border border-blue-200/40 rounded p-3 text-sm text-white/90 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
                  <div className="font-semibold text-blue-100 mb-1">Summary:</div>
                  <div className="prose prose-sm text-white/90">
                    <ReactMarkdown>{selectedVersion.summary}</ReactMarkdown>
                  </div>
                  {failedSaveIds[selectedVersion.id] && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-red-200">
                      <span>Save to memory failed.</span>
                      <button
                        onClick={() => saveSummary(selectedVersion.id, selectedVersion.summary || '')}
                        disabled={savingIds[selectedVersion.id]}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 border border-red-300/30 text-red-100 disabled:opacity-60"
                      >
                        {savingIds[selectedVersion.id] ? 'Retrying…' : 'Retry save'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => generateSummary(selectedVersion)}
                  disabled={generatingIds[selectedVersion.id]}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 rounded-lg transition-colors text-sm font-medium border border-blue-300/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {generatingIds[selectedVersion.id] ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-blue-200" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating summary…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate summary
                    </>
                  )}
                </button>
              )}

              {selectedVersion.change_summary && (
                <div className="bg-purple-500/10 border border-purple-200/40 rounded p-3 text-sm text-white/90 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
                  <span className="font-semibold text-purple-100">Change summary: </span>
                  {selectedVersion.change_summary}
                </div>
              )}

              {(selectedVersion.clean_text || selectedVersion.raw_content) && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-white">Content</h3>
                    {selectedVersion.raw_content && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setVersionViewMode('text')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            versionViewMode === 'text'
                              ? 'bg-blue-600 text-white border-blue-400'
                              : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                          }`}
                        >
                          Text
                        </button>
                        <button
                          onClick={() => setVersionViewMode('preview')}
                          disabled={!selectedVersion.raw_content}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            versionViewMode === 'preview'
                              ? 'bg-blue-600 text-white border-blue-400'
                              : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                          } ${!selectedVersion.raw_content ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          Preview
                        </button>
                      </div>
                    )}
                  </div>
                  {versionViewMode === 'preview' && selectedVersion.raw_content ? (
                    <div className="border border-white/10 rounded p-3 bg-white/5 max-h-96 overflow-auto backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
                      <div
                        className="prose prose-sm max-w-none text-white [&_*]:!text-white"
                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(selectedVersion.raw_content) }}
                      />
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/10 rounded p-3 text-sm text-white whitespace-pre-wrap backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
                      {selectedVersion.clean_text
                        ? `${selectedVersion.clean_text.slice(0, 800)}${
                            selectedVersion.clean_text.length > 800 ? '…' : ''
                          }`
                        : 'No text available for this version.'}
                    </div>
                  )}
                  {versionViewMode === 'text' && (
                    <p className="text-xs text-white/60 mt-2">
                      Showing first 800 characters of extracted text
                    </p>
                  )}
                  {versionViewMode === 'preview' && !selectedVersion.raw_content && (
                    <p className="text-xs text-white/60 mt-2">Preview unavailable for this version.</p>
                  )}
                </div>
              )}
            </div>
        )}
      </GlassModal>

      {/* Loading modal for version */}
      <GlassModal
        open={isDetailLoading}
        onClose={() => setIsDetailLoading(false)}
        title="Loading version…"
      >
        <div className="flex items-center gap-3 text-white">
          <svg className="animate-spin h-5 w-5 text-blue-300" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading…
        </div>
      </GlassModal>
    </main>
  );
}

