'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface MonitoringJob {
  tweet_id: string;
  tweet_url: string;
  status: 'active' | 'completed';
  started_at: string;
  created_at: string;
  stats: {
    is_active: boolean;
    hours_remaining: number;
    minutes_remaining: number;
    total_snapshots: number;
  };
}

export default function MonitorPage() {
  const [jobs, setJobs] = useState<MonitoringJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/monitor-tweet');
      const data = await res.json();
      
      if (data.success) {
        setJobs(data.jobs);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch monitoring jobs');
      }
    } catch {
      setError('Failed to fetch monitoring jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    // Auto-refresh every 30 seconds if there are active jobs
    if (jobs.some(j => j.stats.is_active)) {
      const interval = setInterval(() => {
        fetchJobs();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [jobs, fetchJobs]);

  const getStatusBadge = (job: MonitoringJob) => {
    if (job.stats.is_active) {
      return (
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></div>
          Active
        </span>
      );
    }
    return (
      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
        Completed
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
            <p className="mt-4 text-sm text-zinc-500">Loading monitoring jobs...</p>
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
              onClick={fetchJobs}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeJobs = jobs.filter(j => j.stats.is_active);
  const completedJobs = jobs.filter(j => !j.stats.is_active);

  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <Navbar />
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
              Monitored Tweets
            </h1>
            <p className="mx-auto max-w-xl text-lg text-zinc-500">
              View and manage all your tweet monitoring jobs
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-5xl px-6 pb-16">
          {/* Stats Summary - Dark Glass for Emphasis */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-white shadow-xl backdrop-blur-sm">
              <p className="mb-1 text-xs text-zinc-400">Total Jobs</p>
              <p className="text-3xl font-bold">{jobs.length}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-white shadow-xl backdrop-blur-sm">
              <p className="mb-1 text-xs text-zinc-400">Active</p>
              <p className="text-3xl font-bold text-emerald-400">{activeJobs.length}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-white shadow-xl backdrop-blur-sm">
              <p className="mb-1 text-xs text-zinc-400">Completed</p>
              <p className="text-3xl font-bold text-zinc-300">{completedJobs.length}</p>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                <svg className="h-6 w-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-zinc-900">No monitoring jobs yet.</p>
              <p className="mt-2 text-sm text-zinc-500">
                Start monitoring a tweet from the{' '}
                <Link href="/twtengagement" className="text-indigo-600 hover:text-indigo-700 hover:underline">
                  Engagement Analysis
                </Link>{' '}
                page.
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
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Started
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Time Remaining
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Snapshots
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {jobs.map((job) => (
                      <tr key={job.tweet_id} className="transition-colors hover:bg-zinc-50">
                        <td className="px-4 py-4">
                          <a
                            href={job.tweet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 hover:underline"
                          >
                            {job.tweet_id}
                          </a>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {getStatusBadge(job)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-zinc-500">
                          {new Date(job.started_at).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm">
                          {job.stats.is_active ? (
                            <span className="font-medium text-emerald-600">
                              {job.stats.hours_remaining}h {job.stats.minutes_remaining}m
                            </span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-zinc-900">
                          {job.stats.total_snapshots}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm">
                          <Link
                            href={`/monitor/${job.tweet_id}`}
                            className="font-medium text-indigo-600 transition-colors hover:text-indigo-700 hover:underline"
                          >
                            View Dashboard →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="mt-6 text-center text-xs text-zinc-500">
            {activeJobs.length > 0 && (
              <p className="flex items-center justify-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
                Auto-refreshing every 30 seconds for active monitoring jobs
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
