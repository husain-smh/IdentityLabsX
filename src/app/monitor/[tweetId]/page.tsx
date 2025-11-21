'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  })) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-zinc-400">Loading monitoring data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center glass rounded-2xl p-8 max-w-md">
            <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-bold mb-2">Error</h2>
            <p className="text-zinc-400 mb-6">{error || 'Monitoring data not found'}</p>
            <button
              onClick={() => router.push('/twtengagement')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const latestSnapshot = data.snapshots[data.snapshots.length - 1];
  const firstSnapshot = data.snapshots[0];

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      
      <div className="relative z-10">
        {/* Header */}
        <div className="pt-24 pb-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                  Tweet Monitoring
                </h1>
                <p className="text-zinc-400">
                  Real-time engagement metrics over 24 hours
                </p>
              </div>
              <Link
                href="/twtengagement"
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-2 px-4 rounded-xl transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </Link>
            </div>

            {/* Status Card */}
            <div className="glass rounded-2xl p-6 mb-6">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      data.stats.is_active ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'
                    }`}></div>
                    <span className="text-white font-semibold capitalize">
                      {data.job.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Started</p>
                  <p className="text-white font-medium">
                    {new Date(data.job.started_at).toLocaleString()}
                  </p>
                </div>
                {data.stats.is_active && (
                  <div>
                    <p className="text-zinc-400 text-sm mb-1">Time Remaining</p>
                    <p className="text-white font-medium">
                      {data.stats.hours_remaining}h {data.stats.minutes_remaining}m
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Total Snapshots</p>
                  <p className="text-white font-medium">{data.stats.total_snapshots}</p>
                </div>
                <div className="ml-auto">
                  <a
                    href={data.job.tweet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-2"
                  >
                    View Tweet
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Current Metrics */}
            {latestSnapshot && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <div className="glass rounded-xl p-4">
                  <p className="text-zinc-400 text-sm mb-1">Likes</p>
                  <p className="text-2xl font-bold text-white">{latestSnapshot.likeCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.likeCount > firstSnapshot.likeCount && (
                    <p className="text-green-400 text-xs mt-1">+{(latestSnapshot.likeCount - firstSnapshot.likeCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-zinc-400 text-sm mb-1">Retweets</p>
                  <p className="text-2xl font-bold text-white">{latestSnapshot.retweetCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.retweetCount > firstSnapshot.retweetCount && (
                    <p className="text-green-400 text-xs mt-1">+{(latestSnapshot.retweetCount - firstSnapshot.retweetCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-zinc-400 text-sm mb-1">Replies</p>
                  <p className="text-2xl font-bold text-white">{latestSnapshot.replyCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.replyCount > firstSnapshot.replyCount && (
                    <p className="text-green-400 text-xs mt-1">+{(latestSnapshot.replyCount - firstSnapshot.replyCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-zinc-400 text-sm mb-1">Quotes</p>
                  <p className="text-2xl font-bold text-white">{latestSnapshot.quoteCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.quoteCount > firstSnapshot.quoteCount && (
                    <p className="text-green-400 text-xs mt-1">+{(latestSnapshot.quoteCount - firstSnapshot.quoteCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-zinc-400 text-sm mb-1">Views</p>
                  <p className="text-2xl font-bold text-white">{latestSnapshot.viewCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.viewCount > firstSnapshot.viewCount && (
                    <p className="text-green-400 text-xs mt-1">+{(latestSnapshot.viewCount - firstSnapshot.viewCount).toLocaleString()}</p>
                  )}
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-zinc-400 text-sm mb-1">Bookmarks</p>
                  <p className="text-2xl font-bold text-white">{latestSnapshot.bookmarkCount.toLocaleString()}</p>
                  {firstSnapshot && latestSnapshot.bookmarkCount > firstSnapshot.bookmarkCount && (
                    <p className="text-green-400 text-xs mt-1">+{(latestSnapshot.bookmarkCount - firstSnapshot.bookmarkCount).toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}

            {/* Charts */}
            {chartData.length > 0 ? (
              <div className="space-y-8">
                {/* Engagement Metrics Chart */}
                <div className="glass rounded-2xl p-6">
                  <h2 className="text-white text-xl font-bold mb-6">Engagement Metrics</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9ca3af"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="#9ca3af"
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend 
                        wrapperStyle={{ color: '#9ca3af' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Likes" 
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Retweets" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Replies" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Quotes" 
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Views Chart */}
                <div className="glass rounded-2xl p-6">
                  <h2 className="text-white text-xl font-bold mb-6">Views Over Time</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9ca3af"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="#9ca3af"
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Views" 
                        stroke="#ec4899" 
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-white text-lg font-semibold mb-2">No Data Yet</h3>
                <p className="text-zinc-400">
                  {data.stats.is_active 
                    ? 'Waiting for first metrics snapshot. N8N will collect data every 30 minutes.'
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

