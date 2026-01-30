'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

interface AnalyticsSummary {
  total_scrapes: number;
  successful_scrapes: number;
  failed_scrapes: number;
  success_rate: number;
  average_duration_seconds: number;
  fastest_scrape_seconds: number;
  slowest_scrape_seconds: number;
  largest_scrape_bytes: number;
  total_data_bytes: number;
  average_scrape_bytes: number;
  unique_urls: number;
  total_versions: number;
  urls_with_changes: number;
}

interface TimeSeriesDataPoint {
  date: string;
  scrapes_count: number;
  success_rate: number;
  avg_duration_seconds: number;
  total_data_bytes: number;
}

interface DomainStats {
  domain: string;
  scrapes_count: number;
  success_rate: number;
  avg_duration_seconds: number;
  total_size_bytes: number;
}

interface RecentScrape {
  url: string;
  status: string;
  duration_seconds: number;
  size_bytes: number;
  completed_at: string;
  error?: string;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesDataPoint[]>([]);
  const [domains, setDomains] = useState<DomainStats[]>([]);
  const [recentScrapes, setRecentScrapes] = useState<RecentScrape[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const panelClass =
    'rounded-xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md';
  const scraperBase = (process.env.NEXT_PUBLIC_SCRAPER_API_URL || '/api/arachne')
    .trim()
    .replace(/\/$/, '');

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const [summaryRes, timeSeriesRes, domainsRes, recentRes] = await Promise.all([
          fetch(`${scraperBase}/api/v1/analytics/summary`),
          fetch(`${scraperBase}/api/v1/analytics/timeseries?days=${timeRange}`),
          fetch(`${scraperBase}/api/v1/analytics/domains?limit=10`),
          fetch(`${scraperBase}/api/v1/analytics/recent?limit=20`),
        ]);

        if (!summaryRes.ok || !timeSeriesRes.ok || !domainsRes.ok || !recentRes.ok) {
          throw new Error('One or more analytics requests failed');
        }

        const [summaryData, timeSeriesData, domainsData, recentData] = await Promise.all([
          summaryRes.json(),
          timeSeriesRes.json(),
          domainsRes.json(),
          recentRes.json(),
        ]);

        setSummary(summaryData);
        setTimeSeries(timeSeriesData);
        setDomains(domainsData);
        setRecentScrapes(recentData);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        setFetchError(error instanceof Error ? error.message : 'Failed to fetch analytics');
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange, retryCount]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError || !summary) {
    return (
      <div className="min-h-screen p-8 text-white bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto">
          <div className={`${panelClass} p-8 text-center space-y-4`}>
            <h1 className="text-3xl font-bold">Unable to load analytics</h1>
            <p className="text-white/70">
              {fetchError || 'Analytics data is not available right now.'}
            </p>
            <button
              onClick={() => setRetryCount((c) => c + 1)}
              className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 font-semibold text-white hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusData = [
    { name: 'Successful', value: summary.successful_scrapes },
    { name: 'Failed', value: summary.failed_scrapes },
  ];

  return (
    <div className="min-h-screen p-8 text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white">Analytics Dashboard</h1>
            <p className="text-white mt-2">Monitor your web scraping performance</p>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-purple-400 focus:border-transparent"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Total Scrapes</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {summary.total_scrapes.toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-500/20 p-3 rounded-lg">
                <svg className="w-8 h-8 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-white/60 mt-2">{summary.unique_urls} unique URLs</p>
          </div>

          <div className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Success Rate</p>
                <p className="text-3xl font-bold text-green-300 mt-1">
                  {summary.success_rate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-green-500/20 p-3 rounded-lg">
                <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-white/60 mt-2">
              {summary.successful_scrapes} / {summary.total_scrapes} successful
            </p>
          </div>

          <div className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Avg Duration</p>
                <p className="text-3xl font-bold text-cyan-200 mt-1">
                  {formatDuration(summary.average_duration_seconds)}
                </p>
              </div>
              <div className="bg-cyan-500/20 p-3 rounded-lg">
                <svg className="w-8 h-8 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-white/60 mt-2">
              Fastest: {formatDuration(summary.fastest_scrape_seconds)}
            </p>
          </div>

          <div className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Data Scraped</p>
                <p className="text-3xl font-bold text-orange-200 mt-1">
                  {formatBytes(summary.total_data_bytes)}
                </p>
              </div>
              <div className="bg-orange-500/20 p-3 rounded-lg">
                <svg className="w-8 h-8 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-white/60 mt-2">
              Avg: {formatBytes(summary.average_scrape_bytes)}
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time Series Chart */}
          <div className={`${panelClass} p-6`}>
            <h2 className="text-xl font-semibold text-white mb-4">Scraping Activity</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="scrapes_count"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Scrapes"
                  dot={{ fill: '#8b5cf6', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="success_rate"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Success Rate (%)"
                  dot={{ fill: '#10b981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Status Pie Chart */}
          <div className={`${panelClass} p-6`}>
            <h2 className="text-xl font-semibold text-white mb-4">Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(labelProps: PieLabelRenderProps) => {
                    const name = labelProps.name ?? '';
                    const percent = labelProps.percent ?? 0;
                    return `${name} ${(percent * 100).toFixed(0)}%`;
                  }}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-300">{summary.successful_scrapes}</p>
                <p className="text-sm text-white/70">Successful</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-300">{summary.failed_scrapes}</p>
                <p className="text-sm text-white/70">Failed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Domains Chart */}
        <div className={`${panelClass} p-6`}>
          <h2 className="text-xl font-semibold text-white mb-4">Top Domains</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={domains}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="domain" stroke="#6b7280" fontSize={12} angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number, name: string) => {
                  if (name === 'total_size_bytes') return formatBytes(value);
                  if (name === 'avg_duration_seconds') return formatDuration(value);
                  if (name === 'success_rate') return `${value.toFixed(1)}%`;
                  return value;
                }}
              />
              <Legend />
              <Bar dataKey="scrapes_count" fill="#8b5cf6" name="Scrapes" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Scrapes Table */}
        <div className={`${panelClass} p-6`}>
          <h2 className="text-xl font-semibold text-white mb-4">Recent Scrapes</h2>
          <div className="overflow-x-auto text-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-white/80">URL</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-white/80">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-white/80">Duration</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-white/80">Size</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-white/80">Completed</th>
                </tr>
              </thead>
              <tbody>
                {recentScrapes.map((scrape, index) => (
                  <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-3 px-4 text-sm">
                      <div className="max-w-md truncate" title={scrape.url}>
                        {scrape.url}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          scrape.status === 'success' || scrape.status === 'completed'
                            ? 'bg-green-500/20 text-green-100'
                            : 'bg-red-500/20 text-red-100'
                        }`}
                      >
                        {scrape.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-white/80">
                      {formatDuration(scrape.duration_seconds)}
                    </td>
                    <td className="py-3 px-4 text-sm text-white/80">{formatBytes(scrape.size_bytes)}</td>
                    <td className="py-3 px-4 text-sm text-white/60">
                      {new Date(scrape.completed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90">Largest Scrape</p>
            <p className="text-3xl font-bold mt-1">{formatBytes(summary.largest_scrape_bytes)}</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90">URLs with Changes</p>
            <p className="text-3xl font-bold mt-1">{summary.urls_with_changes}</p>
            <p className="text-xs opacity-75 mt-1">Total versions: {summary.total_versions}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90">Slowest Scrape</p>
            <p className="text-3xl font-bold mt-1">{formatDuration(summary.slowest_scrape_seconds)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

