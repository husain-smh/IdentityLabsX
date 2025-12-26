'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MetricSnapshot {
  timestamp: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  bookmarkCount: number;
  quoteViewSum?: number;
  quoteTweetCount?: number;
}

interface MonitoringData {
  job: {
    tweet_id: string;
    tweet_url: string;
    status: 'active' | 'completed';
    started_at: string;
    created_at: string;
  };
  snapshots: MetricSnapshot[];
  stats: {
    total_snapshots: number;
    is_active: boolean;
    hours_remaining: number;
    minutes_remaining: number;
  };
}

export default function MonitoringDashboard() {
  const params = useParams();
  const router = useRouter();
  const tweetId = params?.tweetId as string;
  
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/monitor-tweet/${tweetId}`);
      const result = await response.json();

      if (response.ok && result.success) {
        setData(result);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch monitoring data');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tweetId]);

  useEffect(() => {
    if (tweetId) {
      fetchData();
    }
  }, [tweetId, fetchData]);

  useEffect(() => {
    if (data?.stats.is_active) {
      // Auto-refresh every 30 seconds if monitoring is active
      const interval = setInterval(() => {
        fetchData();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [data?.stats.is_active, fetchData]);

  const handleStopMonitoring = async () => {
    if (!tweetId || !data?.stats.is_active) return;

    setIsStopping(true);
    try {
      const response = await fetch('/api/monitor-tweet/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Refresh data to show updated status
        await fetchData();
      } else {
        setError(result.error || 'Failed to stop monitoring');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsStopping(false);
    }
  };

  // Format data for charts
  const chartData = data?.snapshots.map((snapshot) => ({
    time: new Date(snapshot.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    fullTime: new Date(snapshot.timestamp).toLocaleString(),
    Likes: snapshot.likeCount,
    Retweets: snapshot.retweetCount,
    Replies: snapshot.replyCount,
    Quotes: snapshot.quoteCount,
    Views: snapshot.viewCount,
    Bookmarks: snapshot.bookmarkCount,
    QuoteViews: snapshot.quoteViewSum ?? 0,
    QuoteTweets: snapshot.quoteTweetCount ?? 0,
  })) || [];

  const chartColor = '#4D4DFF'; // vibrantBlue from Design.json

  const metricCharts = [
    { key: 'Likes', title: 'Likes Over Time', color: chartColor },
    { key: 'Retweets', title: 'Retweets Over Time', color: chartColor },
    { key: 'Replies', title: 'Replies Over Time', color: chartColor },
    { key: 'Quotes', title: 'Quotes Over Time', color: chartColor },
    { key: 'Views', title: 'Views Over Time', color: chartColor },
    { key: 'Bookmarks', title: 'Bookmarks Over Time', color: chartColor },
  ];

  if (loading) {
    return (
      <div className="relative min-h-screen bg-white text-zinc-900">
        <Navbar />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
        <div className="relative z-10 flex min-h-screen items-center justify-center pt-20">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
            <p className="text-sm text-zinc-500">Loading monitoring data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="relative min-h-screen bg-white text-zinc-900">
        <Navbar />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
        <div className="relative z-10 flex min-h-screen items-center justify-center pt-20">
          <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-200 bg-red-50">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-zinc-900">Error</h2>
            <p className="mb-6 text-sm text-zinc-500">{error || 'Monitoring data not found'}</p>
            <button
              onClick={() => router.push('/monitor')}
              className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-500"
            >
              Go Back to All
            </button>
          </div>
        </div>
      </div>
    );
  }

  const latestSnapshot = data.snapshots[data.snapshots.length - 1];
  const firstSnapshot = data.snapshots[0];

  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <Navbar />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
      
      <div className="relative z-10 origin-top-left scale-75" style={{ width: '133.33%', height: '133.33%' }}>
        {/* Header */}
        <div className="pt-20 pb-8">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="mb-2 text-3xl font-semibold text-zinc-900 md:text-4xl">
                  Tweet Monitoring
                </h1>
                <p className="text-sm text-zinc-500">
                  Real-time engagement metrics over 72 hours
                </p>
              </div>
              <div className="flex items-center gap-3">
                {data.stats.is_active && (
                  <button
                    onClick={handleStopMonitoring}
                    disabled={isStopping}
                    className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isStopping ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                        Stopping...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        Stop Monitoring
                      </>
                    )}
                  </button>
                )}
                <Link
                  href="/monitor"
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to All
                </Link>
              </div>
            </div>

            {/* Status Card */}
            <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="mb-1 text-xs text-zinc-500">Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      data.stats.is_active ? 'animate-pulse bg-emerald-500' : 'bg-zinc-400'
                    }`}></div>
                    <span className="text-sm font-semibold capitalize text-zinc-900">
                      {data.job.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-zinc-500">Started</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {new Date(data.job.started_at).toLocaleString()}
                  </p>
                </div>
                {data.stats.is_active && (
                  <div>
                    <p className="mb-1 text-xs text-zinc-500">Time Remaining</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {data.stats.hours_remaining}h {data.stats.minutes_remaining}m
                    </p>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs text-zinc-500">Total Snapshots</p>
                  <p className="text-sm font-medium text-zinc-900">{data.stats.total_snapshots}</p>
                </div>
                <div className="ml-auto">
                  <a
                    href={data.job.tweet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                  >
                    View Tweet
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Current Metrics */}
            {latestSnapshot && (
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="mb-1 text-xs text-zinc-500">Likes</p>
                  <p className="text-xl font-bold text-zinc-900">{latestSnapshot.likeCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.likeCount > firstSnapshot.likeCount && (
                    <p className="mt-1 text-xs text-emerald-600">+{(latestSnapshot.likeCount - firstSnapshot.likeCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="mb-1 text-xs text-zinc-500">Retweets</p>
                  <p className="text-xl font-bold text-zinc-900">{latestSnapshot.retweetCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.retweetCount > firstSnapshot.retweetCount && (
                    <p className="mt-1 text-xs text-emerald-600">+{(latestSnapshot.retweetCount - firstSnapshot.retweetCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="mb-1 text-xs text-zinc-500">Replies</p>
                  <p className="text-xl font-bold text-zinc-900">{latestSnapshot.replyCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.replyCount > firstSnapshot.replyCount && (
                    <p className="mt-1 text-xs text-emerald-600">+{(latestSnapshot.replyCount - firstSnapshot.replyCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="mb-1 text-xs text-zinc-500">Quotes</p>
                  <p className="text-xl font-bold text-zinc-900">{latestSnapshot.quoteCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.quoteCount > firstSnapshot.quoteCount && (
                    <p className="mt-1 text-xs text-emerald-600">+{(latestSnapshot.quoteCount - firstSnapshot.quoteCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="mb-1 text-xs text-zinc-500">Views</p>
                  <p className="text-xl font-bold text-zinc-900">{latestSnapshot.viewCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.viewCount > firstSnapshot.viewCount && (
                    <p className="mt-1 text-xs text-emerald-600">+{(latestSnapshot.viewCount - firstSnapshot.viewCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="mb-1 text-xs text-zinc-500">Bookmarks</p>
                  <p className="text-xl font-bold text-zinc-900">{latestSnapshot.bookmarkCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.bookmarkCount > firstSnapshot.bookmarkCount && (
                    <p className="mt-1 text-xs text-emerald-600">+{(latestSnapshot.bookmarkCount - firstSnapshot.bookmarkCount).toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}

            {/* Charts */}
            {chartData.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {metricCharts.map((cfg) => (
                  <div key={cfg.key} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
                    <h2 className="mb-4 text-base font-semibold text-zinc-900">{cfg.title}</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={chartData}>
                        <defs>
                          <linearGradient id={`grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={cfg.color} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={cfg.color} stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="time"
                          stroke="#71717A"
                          style={{ fontSize: '11px' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#71717A"
                          style={{ fontSize: '11px' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E4E4E7',
                            borderRadius: '8px',
                            color: '#18181B',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                          labelStyle={{ color: '#71717A', fontSize: '11px' }}
                          itemStyle={{ color: '#18181B', fontSize: '12px', fontWeight: 600 }}
                        />
                        <Area
                          type="monotone"
                          dataKey={cfg.key}
                          stroke={cfg.color}
                          strokeWidth={2}
                          fill={`url(#grad-${cfg.key})`}
                          dot={{ r: 2, strokeWidth: 1, fill: cfg.color }}
                          activeDot={{ r: 5 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-xl">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                  <svg className="h-6 w-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-base font-semibold text-zinc-900">No Data Yet</h3>
                <p className="text-sm text-zinc-500">
                  {data.stats.is_active 
                    ? 'Waiting for first metrics snapshot. Scheduler will collect data every few minutes.'
                    : 'Monitoring has completed. No snapshots were collected.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
