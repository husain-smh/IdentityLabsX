'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface Tweet {
  tweet_id: string;
  tweet_url: string;
  author_name: string;
  status: string;
  total_engagers: number;
  engagers_above_10k: number;
  engagers_below_10k: number;
  created_at: string;
  analyzed_at?: string;
}

export default function TweetsPage() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTweets = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/tweets');
      const data = await res.json();
      
      if (data.success) {
        setTweets(data.tweets);
      } else {
        setError(data.error || 'Failed to fetch tweets');
      }
    } catch {
      setError('Failed to fetch tweets');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchTweets();
  }, [fetchTweets]);

  const hasActiveTweets = useMemo(
    () => tweets.some(t => t.status === 'analyzing' || t.status === 'pending'),
    [tweets]
  );

  useEffect(() => {
    if (!hasActiveTweets) {
      return;
    }

    // Auto-refresh every 10 seconds only while there are active tweets
    const interval = setInterval(() => {
      fetchTweets(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [hasActiveTweets, fetchTweets]);

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'border-yellow-200 bg-yellow-50 text-yellow-700',
      analyzing: 'border-blue-200 bg-blue-50 text-blue-700',
      completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      failed: 'border-red-200 bg-red-50 text-red-700',
    };
    
    return (
      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-white text-zinc-900">
        <Navbar />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
        <div className="relative z-10 flex min-h-screen items-center justify-center pt-20">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-zinc-500">Loading tweets...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen bg-white text-zinc-900">
        <Navbar />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
        <div className="relative z-10 flex min-h-screen items-center justify-center pt-20">
          <div className="text-center">
            <p className="text-lg text-red-600">{error}</p>
            <button
              onClick={() => fetchTweets()}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <Navbar />
      {/* Background Pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
      
      <div className="relative z-10 origin-top-left scale-75" style={{ width: '133.33%', height: '133.33%' }}>
        {/* Header Section */}
        <div className="pt-20 pb-12">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 shadow-sm">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></div>
              <span className="text-xs font-medium text-zinc-500">Identity Labs Analytics</span>
            </div>
            <h1 className="mb-4 text-4xl font-semibold leading-tight text-zinc-900 md:text-5xl">
              Tweets Analyzed
            </h1>
            <p className="mx-auto max-w-xl text-lg text-zinc-500">
              View and analyze Twitter engagement data
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-5xl px-6 pb-16">
          {tweets.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                <svg className="h-6 w-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-lg font-medium text-zinc-900">No tweets analyzed yet.</p>
              <p className="mt-2 text-sm text-zinc-500">
                Start by triggering the n8n workflow with a tweet URL.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-zinc-200 bg-white backdrop-blur-sm">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Tweet
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Author
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Engagers
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Created
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {tweets.map((tweet) => (
                      <tr key={tweet.tweet_id} className="transition-colors hover:bg-zinc-50">
                        <td className="px-4 py-4">
                          <a
                            href={tweet.tweet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 hover:underline"
                          >
                            {tweet.tweet_id}
                          </a>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <div className="text-sm font-medium text-zinc-900">
                            {tweet.author_name}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {getStatusBadge(tweet.status)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <div className="text-sm font-medium text-zinc-900">
                            {tweet.total_engagers} total
                          </div>
                          <div className="text-xs text-zinc-500">
                            {tweet.engagers_above_10k} &gt;10k | {tweet.engagers_below_10k} &lt;10k
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-zinc-500">
                          {new Date(tweet.created_at).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm">
                          {tweet.status === 'completed' ? (
                            <Link
                              href={`/tweets/${tweet.tweet_id}`}
                              className="font-medium text-indigo-600 transition-colors hover:text-indigo-700 hover:underline"
                            >
                              View Details →
                            </Link>
                          ) : tweet.status === 'analyzing' ? (
                            <span className="text-zinc-400">Analyzing...</span>
                          ) : tweet.status === 'failed' ? (
                            <span className="text-red-600">Failed</span>
                          ) : (
                            <span className="text-zinc-400">Pending...</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="mt-6 text-center text-xs text-zinc-500">
            {tweets.some(t => t.status === 'analyzing' || t.status === 'pending') && (
              <p className="flex items-center justify-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500"></span>
                Auto-refreshing every 10 seconds for analyzing tweets
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
