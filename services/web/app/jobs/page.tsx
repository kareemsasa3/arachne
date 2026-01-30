'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

type ScrapeMode = 'single' | 'site';

const LAST_JOB_KEY = 'arachne:lastJobId';

type RecentSnapshot = {
  id: string;
  url: string;
  title: string;
  scraped_at: string;
};

export default function NewJobPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ScrapeMode>('single');
  const [url, setUrl] = useState('');
  const [jobName, setJobName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; jobId?: string } | null>(null);
  const [recent, setRecent] = useState<RecentSnapshot[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [rerunId, setRerunId] = useState<string | null>(null);
  const panelClass =
    'rounded-lg border border-white/10 bg-white/5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm';
  const scraperBase = (process.env.NEXT_PUBLIC_SCRAPER_API_URL || '/api/arachne')
    .trim()
    .replace(/\/$/, '');

  const parseUrls = (input: string) => {
    const lines = input
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const validUrls: string[] = [];
    const errors: string[] = [];

    lines.forEach((line, idx) => {
      try {
        new URL(line);
        validUrls.push(line);
      } catch {
        errors.push(`Line ${idx + 1}: Invalid URL "${line}"`);
      }
    });

    return { validUrls, errors };
  };

  const { validUrls: previewValidUrls, errors: previewErrors } = 
    mode === 'single' ? parseUrls(url) : { validUrls: [], errors: [] };

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        setRecentError(null);
        const res = await fetch(
          `${scraperBase}/memory/recent?limit=5&offset=0`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          throw new Error(`Failed to load recent history (${res.status})`);
        }
        const data = await res.json();
        setRecent(data.snapshots || []);
      } catch (err) {
        console.error('Recent history error', err);
        setRecentError('Could not load recent history');
      }
    };
    fetchRecent();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous messages
    setMessage(null);

    const persistJobId = (id: string) => {
      if (typeof window !== 'undefined' && id) {
        localStorage.setItem(LAST_JOB_KEY, id);
      }
    };

    let payload: { 
      urls?: string[]; 
      site_url?: string; 
      name?: string;
    } = {};

    if (mode === 'single') {
      const { validUrls, errors } = parseUrls(url);

      if (!url.trim() || validUrls.length === 0) {
        setMessage({ type: 'error', text: 'At least one URL is required' });
        return;
      }

      if (errors.length > 0) {
        setMessage({ type: 'error', text: errors.join(', ') });
        return;
      }

      payload = { urls: validUrls, name: jobName || undefined };
    } else {
      const siteUrls = url
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (siteUrls.length === 0) {
        setMessage({ type: 'error', text: 'Please enter a site URL' });
        return;
      }

      if (siteUrls.length > 1) {
        setMessage({ type: 'error', text: 'Full site crawl accepts only one starting URL. Use Single URLs mode for multiple pages.' });
        return;
      }

      const siteUrl = siteUrls[0];

      try {
        new URL(siteUrl);
      } catch {
        setMessage({ type: 'error', text: 'Please enter a valid URL (e.g., https://example.com)' });
        return;
      }

      payload = { 
        site_url: siteUrl, 
        name: jobName || undefined
      };
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl('/api/arachne/scrape'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit job');
      }

      console.log('Job submitted successfully:', data);
      setMessage({ 
        type: 'success', 
        text: mode === 'single'
          ? `Scraping ${payload.urls?.length ?? 0} URL${(payload.urls?.length ?? 0) === 1 ? '' : 's'}... Redirecting to job details...`
          : `Job submitted successfully! Redirecting to job details...`,
        jobId: data.job_id
      });
      if (data.job_id) {
        persistJobId(data.job_id);
      }
      
      // Clear form on success
      setUrl('');
      setJobName('');
      
      // Redirect to job status page after 2 seconds
      setTimeout(() => {
        router.push(`/jobs/${data.job_id}`);
      }, 2000);
    } catch (error) {
      console.error('Error submitting job:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to submit job' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAgo = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.max(0, Math.floor(diffMs / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className={`${panelClass} p-4 md:p-6 flex items-start justify-between gap-4`}>
          <div>
            <h1 className="text-4xl font-bold text-white">New Scrape Job</h1>
            <p className="text-white/80">Submit a URL to scrape and extract data</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={`${panelClass} p-6 space-y-6`}>
          {/* How it works */}
          <div className="p-4 bg-blue-500/10 border border-blue-200/40 rounded-lg">
            <h3 className="font-semibold text-blue-100 mb-2">💡 How it works</h3>
            {mode === 'single' ? (
              <ul className="text-sm text-blue-100 space-y-1">
                <li>• Enter the specific URL(s) you want to scrape</li>
                <li>• The scraper will fetch and extract data from those pages</li>
                <li>• Submit the job and receive a unique job ID</li>
                <li>• The scraping job will run asynchronously in the background</li>
              </ul>
            ) : (
              <ul className="text-sm text-blue-100 space-y-1">
                <li>• Enter the starting URL of the site you want to crawl</li>
                <li>• The crawler looks for pagination links (e.g., "Next" buttons) on each page</li>
                <li>• Requires headless browser mode to be enabled on the server</li>
                <li>• Works best with sites that have standard pagination structure</li>
                <li>• The job runs asynchronously and you can monitor progress in real-time</li>
              </ul>
            )}
          </div>

          {/* Mode Toggle */}
          <div>
            <label className="block text-sm font-medium mb-3 text-white">
              Scrape Mode <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex-1">
                <input
                  type="radio"
                  name="mode"
                  value="single"
                  checked={mode === 'single'}
                  onChange={(e) => setMode(e.target.value as ScrapeMode)}
                  disabled={isSubmitting}
                  className="mr-2"
                />
                <span className="font-medium text-white">Single URLs</span>
                <p className="text-xs text-white/70 mt-1 ml-6">
                  Scrape specific pages (multiple URLs allowed, one per line)
                </p>
              </label>
              <label className="flex-1">
                <input
                  type="radio"
                  name="mode"
                  value="site"
                  checked={mode === 'site'}
                  onChange={(e) => setMode(e.target.value as ScrapeMode)}
                  disabled={isSubmitting}
                  className="mr-2"
                />
                <span className="font-medium text-white">Full Site Crawl</span>
                <p className="text-xs text-white/70 mt-1 ml-6">
                  Full Site Crawl - Crawl pages from a single starting URL, following pagination links
                </p>
              </label>
            </div>
          </div>

          {/* Job Name/Description */}
          <div>
            <label htmlFor="jobName" className="block text-sm font-medium mb-2 text-white">
              Job Name (Optional)
            </label>
            <input
              type="text"
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="My scraping job"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={isSubmitting}
            />
            <p className="text-sm text-white/70 mt-1">
              Optional name to help you identify this job
            </p>
          </div>

          {/* URL Input */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium mb-2 text-white">
              {mode === 'single' ? 'URLs' : 'Starting URL'} <span className="text-red-500">*</span>
            </label>
            {mode === 'single' ? (
              <textarea
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter URLs (one per line)"
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white/90 text-gray-900"
                disabled={isSubmitting}
              />
            ) : (
              <textarea
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/start-page"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white/90 text-gray-900"
                disabled={isSubmitting}
              />
            )}
            <p className="text-sm text-white/70 mt-1">
              {mode === 'single' 
                ? 'Enter URLs (one per line). They will be scraped in a single job.'
                : 'Enter starting URL(s); the crawler will discover and scrape linked pages'}
            </p>
            {mode === 'single' && url.trim() && (
              <p className={`text-sm mt-1 ${previewErrors.length ? 'text-red-300' : 'text-green-200'}`}>
                {previewErrors.length
                  ? previewErrors[0]
                  : `Ready to scrape ${previewValidUrls.length} URL${previewValidUrls.length === 1 ? '' : 's'}`}
              </p>
            )}
          </div>

          {/* Site Crawling Info (only for site mode) */}
          {mode === 'site' && (
            <div className="p-4 bg-amber-400/10 border border-amber-200/50 rounded-lg">
              <h4 className="text-sm font-medium text-amber-100 mb-2">
                ⚠️ Site Crawling Requirements
              </h4>
              <div className="text-sm text-amber-50 space-y-2">
                <p>
                  <strong>For multi-page crawling to work:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong>Headless browser must be enabled</strong> - Set the server&apos;s 
                  <code className="bg-amber-200/30 px-1 rounded mx-1 text-amber-50">SCRAPER_USE_HEADLESS=true</code>
                  </li>
                  <li>
                    <strong>Website must have pagination links</strong> - Specifically, the HTML structure 
                    <code className="bg-amber-200/30 px-1 rounded mx-1 text-amber-50">&lt;li class="next"&gt;&lt;a&gt;...&lt;/a&gt;&lt;/li&gt;</code>
                  </li>
                  <li>
                    <strong>Max pages</strong> is controlled by server config (default: 10 pages)
                  </li>
                </ul>
                <p className="mt-2 text-xs">
                  <strong>Note:</strong> If headless mode is disabled (default), only the starting URL will be scraped.
                </p>
              </div>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-100 border border-green-300/40'
                  : 'bg-red-500/10 text-red-100 border border-red-300/40'
              }`}
            >
              <p className="font-medium">
                {message.type === 'success' ? '✓ Success' : '✗ Error'}
              </p>
              <p className="text-sm mt-1">{message.text}</p>
              {message.jobId && (
                <p className="text-xs mt-2 font-mono text-white/80">Job ID: {message.jobId}</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                isSubmitting
                  ? 'bg-white/20 text-white/70 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
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
                  Submitting...
                </span>
              ) : (
                'Submit Job'
              )}
            </button>

            <Link
              href="/"
              className="px-6 py-3 rounded-lg font-medium border border-white/30 text-white hover:bg-white/10 transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
        {/* Recent history (below submit) */}
        <div className="mt-10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recently ran</h2>
            <Link href="/history" className="text-sm text-blue-200 hover:underline">
              View all
            </Link>
          </div>
          <div className={`${panelClass} rounded-xl p-0`}>
            {recentError && (
              <div className="p-4 text-sm text-red-100 bg-red-500/10 border-b border-red-200/50 rounded-t-xl">
                {recentError}
              </div>
            )}
            <ul className="divide-y divide-white/10">
              {recent.length === 0 && !recentError && (
                <li className="p-4 text-sm text-white/80">No recent runs yet.</li>
              )}
              {recent.map((snap) => (
                <li key={snap.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {snap.title || 'Untitled scrape'}
                    </p>
                    <p className="text-xs text-white/70 break-all">{snap.url}</p>
                    <span className="text-xs text-white/60">{formatAgo(snap.scraped_at)}</span>
                  </div>
                  <button
                    onClick={async () => {
                      setRerunId(snap.id);
                      try {
                        const res = await fetch(apiUrl('/api/arachne/scrape'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ urls: [snap.url] }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Failed to rerun');
                        if (data.job_id) {
                          router.push(`/jobs/${data.job_id}`);
                        }
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Failed to rerun');
                      } finally {
                        setRerunId(null);
                      }
                    }}
                    disabled={rerunId === snap.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      rerunId === snap.id
                        ? 'border-white/20 text-white/50 cursor-not-allowed'
                        : 'border-blue-300/50 text-blue-100 hover:bg-blue-500/20'
                    }`}
                  >
                    {rerunId === snap.id ? 'Re-running…' : 'Re-run'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

