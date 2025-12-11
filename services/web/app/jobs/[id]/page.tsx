'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import { useJobStatus } from '@/lib/hooks/useJobStatus';
import { apiUrl } from '@/lib/api';

interface ContentViewState {
  [key: number]: {
    isOpen: boolean;
    viewMode: 'raw' | 'preview';
    isExpanded: boolean;
  };
}

export default function JobStatusPage() {
  const params = useParams();
  const jobId = params.id as string;
  
  const {
    job,
    progress,
    error,
    isLoading,
    isPolling,
  } = useJobStatus(jobId);
  const [contentViewState, setContentViewState] = useState<ContentViewState>({});
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  const [previousResultCount, setPreviousResultCount] = useState(0);
  const [newResultIndices, setNewResultIndices] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  // Track new results when job updates
  useEffect(() => {
    const newResultCount = job?.results?.length || 0;
    if (!job) return;

    if (newResultCount > previousResultCount) {
      const newIndices = new Set<number>();
      for (let i = previousResultCount; i < newResultCount; i++) {
        newIndices.add(i);
      }
      setNewResultIndices(newIndices);

      // Clear "new" badges after 5 seconds
      setTimeout(() => {
        setNewResultIndices(new Set());
      }, 5000);

      setPreviousResultCount(newResultCount);
    } else if (newResultCount === 0) {
      setPreviousResultCount(0);
    }
  }, [job, previousResultCount]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/15 text-yellow-100 border-yellow-400/40';
      case 'running':
        return 'bg-blue-500/15 text-blue-100 border-blue-400/40';
      case 'completed':
        return 'bg-green-500/20 text-green-100 border-green-400/40';
      case 'failed':
        return 'bg-red-500/15 text-red-100 border-red-400/40';
      default:
        return 'bg-white/10 text-white border-white/20';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const toggleContentView = (index: number) => {
    setContentViewState(prev => ({
      ...prev,
      [index]: {
        isOpen: !prev[index]?.isOpen,
        viewMode: prev[index]?.viewMode || 'raw',
        isExpanded: prev[index]?.isExpanded || false,
      }
    }));
  };

  const toggleViewMode = (index: number) => {
    setContentViewState(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        viewMode: prev[index]?.viewMode === 'raw' ? 'preview' : 'raw',
      }
    }));
  };

  const toggleExpand = (index: number) => {
    setContentViewState(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        isExpanded: !prev[index]?.isExpanded,
      }
    }));
  };

  const copyToClipboard = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(index);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const truncateContent = (content: string, maxLength: number = 5000) => {
    return content.length > maxLength ? content.slice(0, maxLength) : content;
  };

  const generateSummary = async () => {
    if (!job || !job.results || job.results.length === 0) {
      return;
    }

    // Clear existing summary and error before generating
    setSummary(null);
    setSummaryError(null);
    setIsSummarizing(true);
    setIsSummaryExpanded(true);

    try {
      console.log(`Generating streaming AI summary for job ${jobId}...`);
      const response = await fetch(apiUrl('/api/summarize'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: job.id,
          results: job.results,
          stream: true, // Enable streaming
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      // Check if we got a streaming response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        // Handle SSE streaming
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedSummary = '';

        if (!reader) {
          throw new Error('No response body');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  throw new Error(data.error);
                }
                
                if (data.chunk) {
                  accumulatedSummary += data.chunk;
                  setSummary(accumulatedSummary);
                }
                
                if (data.done && data.fullSummary) {
                  setSummary(data.fullSummary);
                }
              } catch {
                // Ignore parse errors for incomplete chunks
                if (line.slice(6).trim()) {
                  console.debug('Skipping incomplete SSE chunk');
                }
              }
            }
          }
        }

        console.log('Streaming summary completed');
      } else {
        // Fallback to non-streaming response
        const data = await response.json();
        console.log('Summary generated successfully');
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Error generating summary:', err);
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsSummarizing(false);
    }
  };

  const sanitizeHTML = (html: string) => {
    // Extract body content if the input is a full HTML document
    let contentToSanitize = html;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      contentToSanitize = bodyMatch[1];
    }

    return DOMPurify.sanitize(contentToSanitize, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'table', 'thead', 'tbody',
        'tr', 'td', 'th', 'blockquote', 'code', 'pre', 'section', 'article',
        'header', 'footer', 'nav', 'main', 'aside', 'figure', 'figcaption',
        'b', 'i', 'small', 'sub', 'sup', 'mark', 'del', 'ins', 'hr',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
    });
  };

  const panelClass =
    'rounded-lg border border-white/10 bg-white/10 shadow-lg backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md';

  if (isLoading) {
    return (
      <main className="min-h-screen bg-transparent text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-16">
          <div className="flex flex-col items-center gap-4">
            <svg
              className="h-12 w-12 animate-spin text-blue-400"
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
            <p className="text-slate-200">Loading job details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="min-h-screen bg-transparent text-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 shadow-md">
            <h2 className="mb-2 text-xl font-semibold text-red-100">Error</h2>
            <p className="mb-4 text-red-50">{error || 'Job not found'}</p>
            
            <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-4">
              <p className="mb-2 text-sm font-semibold text-red-100/90">Debug Information:</p>
              <ul className="space-y-1 text-xs text-red-50/80">
                <li>• Job ID: <code className="rounded bg-white/10 px-1">{jobId}</code></li>
                <li>• API Endpoint: <code className="rounded bg-white/10 px-1">/api/scrape/status?id={jobId}</code></li>
                <li>• Check the browser console for more details</li>
                <li>• Make sure the Arachne backend is running on port 8080</li>
              </ul>
            </div>
            
            <div className="flex gap-4">
              <Link
                href="/"
                className="font-medium text-blue-200 hover:text-white"
              >
                ← Back to Home
              </Link>
              <Link
                href="/jobs"
                className="font-medium text-blue-200 hover:text-white"
              >
                Create New Job
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const progressValue = job?.progress ?? progress ?? 0;

  return (
    <main className="min-h-screen bg-transparent text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="mb-4 inline-block text-blue-200 hover:text-white"
          >
            ← Back to Home
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-3xl font-semibold">Job Details</h1>
              <p className="text-sm text-slate-300">View scraping job status and details</p>
            </div>
            {isPolling && (
              <div className="flex items-center gap-2 text-sm text-blue-200">
                <svg
                  className="h-4 w-4 animate-spin"
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
                <span className="font-medium">Auto-updating...</span>
              </div>
            )}
          </div>
        </div>

        {/* Job Status Card */}
        <div className={`${panelClass} mb-6 text-white/90`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-slate-200/80 mb-1">Job ID</h2>
              <p className="text-lg font-mono text-white">{job.id}</p>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(
                job.status
              )}`}
            >
              {job.status.toUpperCase()}
            </span>
          </div>

          {/* Progress Bar */}
          {job.status === 'running' && (
            <div className="mb-4">
            <div className="mb-1 flex justify-between text-sm text-slate-200/90">
                <span>Progress</span>
                <span>{progressValue}%</span>
              </div>
            <div className="h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <h3 className="text-sm font-medium text-slate-200/80 mb-1">Created</h3>
              <p className="text-sm text-white/90">{formatDate(job.created_at)}</p>
            </div>
            {job.started_at && (
              <div>
                <h3 className="text-sm font-medium text-slate-200/80 mb-1">Started</h3>
                <p className="text-sm text-white/90">{formatDate(job.started_at)}</p>
              </div>
            )}
            {job.completed_at && (
              <div>
                <h3 className="text-sm font-medium text-slate-200/80 mb-1">
                  Completed
                </h3>
                <p className="text-sm text-white/90">{formatDate(job.completed_at)}</p>
              </div>
            )}
          </div>

          {/* URLs Being Scraped */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-200/80">
              {job.request.site_url ? 'Site URL' : 'URLs'}
            </h3>
            {job.request.site_url ? (
              <p className="break-all rounded border border-white/10 bg-white/5 p-2 text-sm text-white/90">
                {job.request.site_url}
              </p>
            ) : (
              <div className="space-y-1">
                {job.request.urls.map((url, index) => (
                  <p
                    key={index}
                    className="break-all rounded border border-white/10 bg-white/5 p-2 text-sm text-white/90"
                  >
                    {url}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {job.error && (
          <div className="mt-4 rounded border border-red-400/30 bg-red-500/10 p-4">
            <h3 className="mb-1 text-sm font-medium text-red-100">Error</h3>
            <p className="text-sm text-red-200">{job.error}</p>
            </div>
          )}
        </div>

        {/* AI Summary Section - Appears above Results */}
        {job.status === 'completed' && job.results && job.results.length > 0 && (
          <div className={`${panelClass} mb-6 text-white/90`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white">AI Summary</h2>
              </div>
              <div className="flex items-center gap-3">
                {summary && !isSummarizing && (
                  <button
                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    className="text-sm text-slate-200 hover:text-white font-medium"
                  >
                    {isSummaryExpanded ? 'Collapse' : 'Expand'}
                  </button>
                )}
                {!isSummarizing && (summary || summaryError) ? (
                  <button
                    onClick={generateSummary}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate Summary
                  </button>
                ) : !isSummarizing && (
                  <button
                    onClick={generateSummary}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate AI Summary
                  </button>
                )}
              </div>
            </div>

            {/* Loading State - Show streaming indicator when summarizing without content yet */}
            {isSummarizing && !summary && (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <svg
                  className="animate-spin h-10 w-10 text-purple-400"
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
                <p className="text-slate-100 font-medium">Generating AI summary...</p>
                <p className="text-sm text-slate-300/80">Content will appear in real-time</p>
              </div>
            )}

            {/* Error State */}
            {summaryError && !isSummarizing && (
              <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-200 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-100 mb-1">Failed to generate summary</h3>
                    <p className="text-sm text-red-200">{summaryError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Content - Shows during streaming and after completion */}
            {summary && isSummaryExpanded && (
              <div className="prose prose-sm prose-invert max-w-none text-slate-100">
                <div className={`bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/30 rounded-lg p-6 ${isSummarizing ? 'animate-pulse' : ''}`}>
                  {isSummarizing && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-purple-200">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="font-medium">Generating...</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-slate-100 leading-relaxed">
                    {summary}
                    {isSummarizing && <span className="inline-block w-2 h-5 ml-1 bg-purple-600 animate-pulse"></span>}
                  </div>
                </div>
                {!isSummarizing && (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => copyToClipboard(summary, -1)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors"
                    >
                      {copySuccess === -1 ? (
                        <>
                          <svg className="w-4 h-4 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-200">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Summary
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSummary(null);
                        setSummaryError(null);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear Summary
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* No Summary Yet - Initial State */}
            {!summary && !isSummarizing && !summaryError && (
              <div className="text-center py-6">
                <p className="text-slate-200/90">Click &quot;Generate AI Summary&quot; to create a comprehensive summary of all scraped content.</p>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {job.results && job.results.length > 0 && (
          <div className={`${panelClass} mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white/80">
                Results ({job.results.length})
                {job.status === 'running' && (
                  <span className="ml-2 text-sm font-normal text-blue-200">
                    • Live updates
                  </span>
                )}
              </h2>
            </div>
            <div className="space-y-3">
              {job.results
                .map((result, originalIndex) => ({ result, originalIndex }))
                .sort((a, b) => {
                  // Sort by timestamp, newest first
                  const timeA = new Date(a.result.scraped).getTime();
                  const timeB = new Date(b.result.scraped).getTime();
                  return timeB - timeA;
                })
                .map(({ result, originalIndex: index }) => {
                const viewState = contentViewState[index] || {
                  isOpen: false,
                  viewMode: 'raw',
                  isExpanded: false,
                };
                const hasContent = result.content && result.content.trim().length > 0;
                const contentLength = result.content?.length || 0;
                const needsTruncation = contentLength > 5000;

                const isNew = newResultIndices.has(index);
                const resultCardClass = `${panelClass} p-4 transition-all duration-500 ${
                  isNew ? 'border-blue-400/60 bg-blue-500/10 animate-pulse' : 'hover:border-blue-300/40 hover:bg-white/10'
                }`;
                
                return (
                  <div
                    key={index}
                    className={resultCardClass}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 mr-4">
                        <h3 className="font-medium text-lg text-white/80">
                          {result.title || 'No title'}
                        </h3>
                        {isNew && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white animate-bounce">
                            NEW
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold border ${
                          result.status >= 200 && result.status < 300
                            ? 'bg-green-500/20 text-green-100 border-green-400/40'
                            : 'bg-red-500/15 text-red-100 border-red-400/40'
                        }`}
                      >
                        {result.status}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 break-all mb-2">
                      {result.url}
                    </p>
                    <div className="flex gap-4 text-xs text-white/60 mb-3">
                      <span>Size: {(result.size / 1024).toFixed(2)} KB</span>
                      <span>Scraped: {formatDate(result.scraped)}</span>
                      {hasContent && (
                        <span>Content: {(contentLength / 1024).toFixed(2)} KB</span>
                      )}
                    </div>
                    {result.error && (
                      <p className="text-sm text-red-200 mt-2 mb-3">{result.error}</p>
                    )}
                    
                    {/* View Content Button */}
                    {hasContent && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleContentView(index)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-blue-400/30 hover:bg-blue-500/10 text-blue-100 rounded-lg transition-colors text-sm font-medium"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${
                              viewState.isOpen ? 'rotate-90' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          {viewState.isOpen ? 'Hide Content' : 'View Content'}
                        </button>

                        {/* Content Display */}
                        {viewState.isOpen && (
                          <div className="mt-4 border-t pt-4">
                            {/* Controls */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => toggleViewMode(index)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                    viewState.viewMode === 'raw'
                                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                      : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  Raw HTML
                                </button>
                                <button
                                  onClick={() => toggleViewMode(index)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                    viewState.viewMode === 'preview'
                                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                      : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  Preview
                                </button>
                              </div>
                              <button
                                onClick={() => copyToClipboard(result.content!, index)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors"
                              >
                                {copySuccess === index ? (
                                  <>
                                    <svg className="w-4 h-4 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-green-200">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Raw HTML View */}
                            {viewState.viewMode === 'raw' && (
                              <div className="relative">
                                <pre className="bg-black/50 text-slate-100 border border-white/10 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed backdrop-blur">
                                  <code>
                                    {viewState.isExpanded || !needsTruncation
                                      ? result.content
                                      : truncateContent(result.content!)}
                                  </code>
                                </pre>
                                {needsTruncation && (
                                  <button
                                    onClick={() => toggleExpand(index)}
                                    className="mt-2 text-sm text-blue-200 hover:text-blue-100 font-medium"
                                  >
                                    {viewState.isExpanded ? '← Show Less' : 'Show More →'}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Preview View */}
                            {viewState.viewMode === 'preview' && (
                              (() => {
                                const sanitizedContent = sanitizeHTML(result.content!);
                                const previewNeedsTruncation = sanitizedContent.length > 5000;
                                const previewContent = viewState.isExpanded || !previewNeedsTruncation
                                  ? sanitizedContent
                                  : truncateContent(sanitizedContent);

                                return (
                                  <div className="relative">
                                    <div className="border border-white/10 rounded-lg p-4 bg-white/5 overflow-auto max-h-96 backdrop-blur">
                                      <div
                                        style={{ color: '#e5e7eb' }}
                                        className="prose prose-sm prose-invert max-w-none [&_*]:!text-white"
                                        dangerouslySetInnerHTML={{
                                          __html: previewContent,
                                        }}
                                      />
                                    </div>
                                    {previewNeedsTruncation && (
                                      <button
                                        onClick={() => toggleExpand(index)}
                                        className="mt-2 text-sm text-blue-200 hover:text-blue-100 font-medium"
                                      >
                                        {viewState.isExpanded ? '← Show Less' : 'Show More →'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* No Results Yet */}
        {(!job.results || job.results.length === 0) &&
          job.status !== 'failed' && (
            <div className={`${panelClass} text-white/90 rounded-lg p-8 text-center`}>
              {job.status === 'completed' ? (
                <p className="text-slate-200/90">No results available for this job</p>
              ) : job.status === 'running' ? (
                <div className="flex flex-col items-center gap-3">
                  <svg
                    className="animate-spin h-8 w-8 text-blue-300"
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
                  <p className="text-slate-100 font-medium">
                    Scraping in progress...
                  </p>
                  <p className="text-sm text-slate-300/90">
                    Results will appear here in real-time as they arrive
                  </p>
                </div>
              ) : (
                <p className="text-slate-200/90">
                  Waiting for job to start...
                </p>
              )}
            </div>
          )}
      </div>
    </main>
  );
}

