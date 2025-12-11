'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface Snapshot {
  id: string;
  url: string;
  domain: string;
  title: string;
  content_hash: string;
  summary?: string;
  scraped_at: string;
  last_checked_at: string;
  age_hours: number;
  status_code: number;
}

interface HistoryResponse {
  snapshots: Snapshot[];
  total: number;
  limit: number;
  offset: number;
}

interface SnapshotDetails extends Snapshot {
  clean_text?: string;
  raw_html?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotDetails | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRescrapingId, setIsRescrapingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [failedSaveIds, setFailedSaveIds] = useState<Set<string>>(new Set());
  const panelClass =
    'rounded-lg border border-white/10 bg-white/5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm';

  const fetchHistory = useCallback(async (newOffset: number = 0) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://localhost:8080'}/memory/recent?limit=${limit}&offset=${newOffset}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }

      const data: HistoryResponse = await response.json();
      setSnapshots(data.snapshots || []);
      setTotal(data.total);
      setOffset(newOffset);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHistory(0);
  }, [fetchHistory]);

  const formatTimeAgo = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      const roundedHours = Math.floor(hours);
      return `${roundedHours} hour${roundedHours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const viewDetails = async (snapshot: Snapshot) => {
    setIsDetailLoading(true);
    setSelectedSnapshot(null);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://localhost:8080'}/memory/lookup?url=${encodeURIComponent(snapshot.url)}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch snapshot details');
      }

      const data = await response.json();
      if (data.found && data.snapshot) {
        // Fetch full snapshot with content
        setSelectedSnapshot({
          ...snapshot,
          clean_text: data.snapshot.clean_text || '',
          raw_html: data.snapshot.raw_html || '',
        });
      }
    } catch (err) {
      console.error('Error fetching details:', err);
      alert('Failed to load snapshot details');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRescrape = async (url: string, snapshotId: string) => {
    setIsRescrapingId(snapshotId);
    
    try {
      const response = await fetch(apiUrl('/api/scrape'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: [url],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start scraping job');
      }

      const data = await response.json();
      
      // Show success notification
      alert(`Re-scraping ${url}...\nJob ID: ${data.jobId}`);
      
      // Redirect to job status page
      if (data.jobId) {
        router.push(`/jobs/${data.jobId}`);
      }
    } catch (err) {
      console.error('Error re-scraping:', err);
      alert(`Failed to re-scrape: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRescrapingId(null);
    }
  };

  const toggleSummaryExpansion = (snapshotId: string) => {
    setExpandedSummaries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(snapshotId)) {
        newSet.delete(snapshotId);
      } else {
        newSet.add(snapshotId);
      }
      return newSet;
    });
  };

  const truncateSummary = (summary: string, maxLength: number = 200): string => {
    if (summary.length <= maxLength) return summary;
    return summary.substring(0, maxLength) + '...';
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this version?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://localhost:8080'}/memory/version/${id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        throw new Error(`Failed to delete (status ${res.status})`);
      }
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Delete failed', err);
      alert(err instanceof Error ? err.message : 'Failed to delete version');
    } finally {
      setDeletingId(null);
    }
  };

  const saveSummary = async (snapshotId: string, summary: string) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.add(snapshotId);
      return next;
    });
    try {
      const scraperUrl = process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://localhost:8080';
      const token = process.env.NEXT_PUBLIC_SCRAPER_API_TOKEN;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch(`${scraperUrl}/memory/snapshot/${snapshotId}/summary`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ summary }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || `Save failed (${resp.status})`);
      }
      setFailedSaveIds((prev) => {
        const next = new Set(prev);
        next.delete(snapshotId);
        return next;
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(snapshotId);
        return next;
      });
    }
  };

  const generateSummary = async (snapshot: Snapshot) => {
    if (generatingIds.has(snapshot.id)) return;
    setGeneratingIds((prev) => {
      const next = new Set(prev);
      next.add(snapshot.id);
      return next;
    });

    try {
      // Fetch full snapshot content for summarization
      const detailResp = await fetch(
        `${process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://localhost:8080'}/memory/lookup?url=${encodeURIComponent(snapshot.url)}`,
        { cache: 'no-store' }
      );
      if (!detailResp.ok) throw new Error('Failed to load snapshot content');
      const detail = await detailResp.json();
      const content =
        detail?.snapshot?.clean_text ||
        detail?.snapshot?.raw_html ||
        detail?.snapshot?.content ||
        '';
      if (!content) throw new Error('No content available to summarize');

      const aiResp = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          url: snapshot.url,
          title: snapshot.title || '',
        }),
      });
      if (!aiResp.ok) {
        const err = await aiResp.json().catch(() => ({}));
        throw new Error(err.error || `AI summarize failed (${aiResp.status})`);
      }
      const aiData = await aiResp.json();
      const newSummary = aiData.summary || '';
      if (!newSummary) throw new Error('Empty summary returned');

      setSnapshots((prev) =>
        prev.map((s) => (s.id === snapshot.id ? { ...s, summary: newSummary } : s))
      );
      if (selectedSnapshot && selectedSnapshot.id === snapshot.id) {
        setSelectedSnapshot({ ...selectedSnapshot, summary: newSummary });
      }

      // Attempt to persist summary to scraper DB
      try {
        await saveSummary(snapshot.id, newSummary);
      } catch (err) {
        console.error('Save summary failed', err);
        setFailedSaveIds((prev) => {
          const next = new Set(prev);
          next.add(snapshot.id);
          return next;
        });
        alert(err instanceof Error ? err.message : 'Failed to save summary to memory');
      }
    } catch (err) {
      console.error('Generate summary failed', err);
      alert(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(snapshot.id);
        return next;
      });
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  if (isLoading && snapshots.length === 0) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className={`flex flex-col items-center gap-4 ${panelClass} px-6 py-4`}>
              <svg
                className="animate-spin h-12 w-12 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <p className="text-white/80">Loading scrape history...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className={`${panelClass} p-4 md:p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Scrape History</h1>
              <p className="text-white/80">
                View all previously scraped URLs from memory
              </p>
            </div>
            <button
              onClick={() => fetchHistory(offset)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 rounded-lg transition-colors text-sm font-medium border border-blue-300/30"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className={`${panelClass} p-4`}>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-white/80">Total Snapshots:</span>
              <span className="ml-2 font-semibold text-white">{total}</span>
            </div>
            <div>
              <span className="text-white/80">Showing:</span>
              <span className="ml-2 font-semibold text-white">
                {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </span>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className={`${panelClass} p-6 bg-red-500/10 border-red-200/50`}>
            <h2 className="text-xl font-semibold text-red-100 mb-2">Error</h2>
            <p className="text-red-100 mb-4">{error}</p>
            <div className="flex gap-4">
              <button
                onClick={() => fetchHistory(offset)}
                className="text-blue-200 hover:text-blue-100 font-medium"
              >
                Retry
              </button>
              <Link
                href="/"
                className="text-blue-200 hover:text-blue-100 font-medium"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}

        {/* Snapshots List */}
        {!error && snapshots.length > 0 && (
          <div className={`${panelClass} p-6`}>
            <div className="space-y-3">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="border border-white/10 rounded-lg p-4 bg-white/5 hover:border-blue-300/60 transition-colors backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-lg text-white">
                          {snapshot.title || 'No title'}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            snapshot.status_code >= 200 && snapshot.status_code < 300
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {snapshot.status_code}
                        </span>
                      </div>
                      <p className="text-sm text-white/80 mb-1">
                        <span className="font-medium">{snapshot.domain}</span>
                      </p>
                      <p className="text-xs text-white/80 break-all">
                        {snapshot.url}
                      </p>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {snapshot.summary ? (
                    <div className="mb-3 mt-2">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm text-white/80 italic">
                            {expandedSummaries.has(snapshot.id) 
                              ? snapshot.summary 
                              : truncateSummary(snapshot.summary, 200)}
                          </p>
                          {snapshot.summary.length > 200 && (
                            <button
                              onClick={() => toggleSummaryExpansion(snapshot.id)}
                              className="text-xs text-purple-600 hover:text-purple-700 font-medium mt-1"
                            >
                              {expandedSummaries.has(snapshot.id) ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </div>
                      </div>
                      {failedSaveIds.has(snapshot.id) && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-200">
                          <span>Save to memory failed.</span>
                          <button
                            onClick={() => saveSummary(snapshot.id, snapshot.summary || '')}
                            disabled={savingIds.has(snapshot.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 border border-red-300/30 text-red-100 disabled:opacity-60"
                          >
                            {savingIds.has(snapshot.id) ? 'Retrying…' : 'Retry save'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-3 mt-2">
                      <button
                        onClick={() => generateSummary(snapshot)}
                        disabled={generatingIds.has(snapshot.id)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 rounded-lg transition-colors text-sm font-medium border border-blue-300/30 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {generatingIds.has(snapshot.id) ? (
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

                  {/* Metadata */}
                  <div className="flex gap-4 text-xs text-white/80 mb-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Scraped: {formatTimeAgo(snapshot.age_hours)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Last checked: {formatDate(snapshot.last_checked_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      <span>Hash: {snapshot.content_hash.substring(0, 12)}...</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => viewDetails(snapshot)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Details
                    </button>
                    <button
                      onClick={() => handleRescrape(snapshot.url, snapshot.id)}
                      disabled={isRescrapingId === snapshot.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors text-sm font-medium ${
                        isRescrapingId === snapshot.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isRescrapingId === snapshot.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Re-scraping...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Re-scrape
                        </>
                      )}
                    </button>
                    <Link
                      href={`/history/${encodeURIComponent(snapshot.url)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      View history
                    </Link>
                    <button
                      onClick={() => handleDelete(snapshot.id)}
                      disabled={deletingId === snapshot.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                        deletingId === snapshot.id
                          ? 'bg-red-100 text-red-400 cursor-not-allowed'
                          : 'bg-red-50 hover:bg-red-100 text-red-700'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingId === snapshot.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {!error && totalPages > 1 && (
          <div className={`${panelClass} p-4 flex items-center justify-between`}>
            <button
              onClick={() => fetchHistory(Math.max(0, offset - limit))}
              disabled={offset === 0 || isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                offset === 0 || isLoading
                  ? 'bg-white/5 text-white/40 cursor-not-allowed'
                  : 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>

            <span className="text-sm text-white/80">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => fetchHistory(offset + limit)}
              disabled={offset + limit >= total || isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                offset + limit >= total || isLoading
                  ? 'bg-white/5 text-white/40 cursor-not-allowed'
                  : 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-100'
              }`}
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!error && !isLoading && snapshots.length === 0 && (
          <div className={`${panelClass} p-12 text-center`}>
            <svg
              className="w-16 h-16 text-white/60 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-white mb-2">
              No scraping history yet
            </h2>
            <p className="text-white/80 mb-6">
              Start by creating your first scraping job
            </p>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Job
            </Link>
          </div>
        )}

        {/* Details Modal */}
        {selectedSnapshot && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedSnapshot(null)}
          >
            <div
              className="bg-white/10 border border-white/15 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-black/30 border-b border-white/10 backdrop-blur-md p-6 flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Snapshot Details
                  </h2>
                  <p className="text-sm text-white/80 break-all">
                    {selectedSnapshot.url}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-1">Title</h3>
                    <p className="text-sm text-white">{selectedSnapshot.title || 'No title'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-1">Domain</h3>
                    <p className="text-sm text-white">{selectedSnapshot.domain}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-1">Status Code</h3>
                    <p className="text-sm text-white">{selectedSnapshot.status_code}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-1">Snapshot ID</h3>
                    <p className="text-sm text-white font-mono break-all">{selectedSnapshot.id}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-1">Scraped At</h3>
                    <p className="text-sm text-white">{formatDate(selectedSnapshot.scraped_at)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-1">Last Checked At</h3>
                    <p className="text-sm text-white">{formatDate(selectedSnapshot.last_checked_at)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-1">Age</h3>
                    <p className="text-sm text-white">{formatTimeAgo(selectedSnapshot.age_hours)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-1">Content Hash</h3>
                    <p className="text-sm text-white font-mono break-all">{selectedSnapshot.content_hash}</p>
                  </div>
                </div>

                {/* AI Summary */}
                {selectedSnapshot.summary && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <h3 className="text-sm font-medium text-white">AI Summary</h3>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
                      <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                        {selectedSnapshot.summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Content Preview */}
                {selectedSnapshot.clean_text && (
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-2">Content Preview (first 500 characters)</h3>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
                      <p className="text-sm text-white/90 whitespace-pre-wrap">
                        {selectedSnapshot.clean_text.substring(0, 500)}
                        {selectedSnapshot.clean_text.length > 500 ? '...' : ''}
                      </p>
                    </div>
                    <p className="text-xs text-white/60 mt-2">
                      Total content length: {selectedSnapshot.clean_text.length.toLocaleString()} characters
                    </p>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-black/30 border-t border-white/10 backdrop-blur-md p-6 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="px-4 py-2 text-white bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleRescrape(selectedSnapshot.url, selectedSnapshot.id);
                    setSelectedSnapshot(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition-colors font-medium border border-green-300/30 shadow"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-scrape Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Loading Modal */}
        {isDetailLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
              <svg
                className="animate-spin h-12 w-12 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <p className="text-gray-600 font-medium">Loading details...</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

