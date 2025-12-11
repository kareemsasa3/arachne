import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api';

type ScrapedData = {
  url: string;
  title: string;
  status: number;
  size: number;
  error?: string;
  scraped: string;
  content?: string;
};

type Job = {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  request: {
    urls: string[];
    site_url?: string;
  };
  results?: ScrapedData[];
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
};

type JobResponse = {
  job: Job;
  metrics?: unknown;
};

const LOCAL_STORAGE_KEY = 'arachne:lastJobId';
const DEFAULT_POLL_MS = 3000;

export function useJobStatus(initialJobId?: string, pollIntervalMs: number = DEFAULT_POLL_MS) {
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? null);
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!initialJobId);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isBrowser = typeof window !== 'undefined';

  const clearPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const persistJobId = useCallback(
    (id: string | null) => {
      if (!isBrowser) return;
      if (id) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, id);
      } else {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    },
    [isBrowser],
  );

  const fetchStatus = useCallback(
    async (id: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(apiUrl(`/api/scrape/status?id=${encodeURIComponent(id)}`), {
          cache: 'no-store',
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `Failed to fetch status (${response.status})`);
        }

        const data: JobResponse = await response.json();
        setJob(data.job);
        setError(null);
        return data.job;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch job status';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const start = useCallback(
    async (id: string) => {
      setJobId(id);
      persistJobId(id);
      const latest = await fetchStatus(id);

      if (latest && (latest.status === 'pending' || latest.status === 'running')) {
        setIsPolling(true);
        clearPoll();
        intervalRef.current = setInterval(async () => {
          const updated = await fetchStatus(id);
          if (updated && (updated.status === 'completed' || updated.status === 'failed')) {
            clearPoll();
            persistJobId(null);
          }
        }, pollIntervalMs);
      } else {
        // Completed/failed or fetch error
        clearPoll();
        if (latest && (latest.status === 'completed' || latest.status === 'failed')) {
          persistJobId(null);
        }
      }
    },
    [clearPoll, fetchStatus, persistJobId, pollIntervalMs],
  );

  const stop = useCallback(() => {
    clearPoll();
  }, [clearPoll]);

  const clear = useCallback(() => {
    clearPoll();
    setJobId(null);
    setJob(null);
    setError(null);
    persistJobId(null);
  }, [clearPoll, persistJobId]);

  // Auto-resume if a jobId is stored
  useEffect(() => {
    if (!isBrowser) return;
    if (jobId) return; // already set

    const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      start(saved);
    }
  }, [isBrowser, jobId, start]);

  // If initialJobId changes (e.g., navigation), restart
  useEffect(() => {
    if (initialJobId) {
      start(initialJobId);
    }
  }, [initialJobId, start]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      clearPoll();
    },
    [clearPoll],
  );

  const refetch = useCallback(async () => {
    if (jobId) {
      return fetchStatus(jobId);
    }
    return null;
  }, [fetchStatus, jobId]);

  return {
    job,
    jobId,
    status: job?.status ?? 'unknown',
    progress: job?.progress ?? 0,
    error,
    isLoading,
    isPolling,
    start,
    stop,
    clear,
    refetch,
  };
}


