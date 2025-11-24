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
        <span className="px-3 py-1 rounded-full text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Active
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium border bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
        Completed
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
        <div className="relative z-10 pt-20 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-zinc-400">Loading monitoring jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
        <div className="relative z-10 pt-20 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-400 text-lg">{error}</p>
            <button
              onClick={fetchJobs}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
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
    <div className="min-h-screen bg-black">
      <Navbar />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      
      <div className="relative z-10">
        {/* Header Section */}
        <div className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-zinc-400 text-sm font-medium">Identity Labs Analytics</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Monitored Tweets</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              View and manage all your tweet monitoring jobs
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="glass rounded-xl p-6">
              <p className="text-zinc-400 text-sm mb-1">Total Jobs</p>
              <p className="text-3xl font-bold text-white">{jobs.length}</p>
            </div>
            <div className="glass rounded-xl p-6">
              <p className="text-zinc-400 text-sm mb-1">Active</p>
              <p className="text-3xl font-bold text-green-400">{activeJobs.length}</p>
            </div>
            <div className="glass rounded-xl p-6">
              <p className="text-zinc-400 text-sm mb-1">Completed</p>
              <p className="text-3xl font-bold text-zinc-400">{completedJobs.length}</p>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-zinc-300 text-lg font-medium">No monitoring jobs yet.</p>
              <p className="text-zinc-500 mt-2">
                Start monitoring a tweet from the{' '}
                <Link href="/twtengagement" className="text-indigo-400 hover:text-indigo-300 underline">
                  Engagement Analysis
                </Link>{' '}
                page.
              </p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Tweet
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Started
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Time Remaining
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Snapshots
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {jobs.map((job) => (
                      <tr key={job.tweet_id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="px-6 py-4">
                          <a
                            href={job.tweet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 hover:underline text-sm font-medium"
                          >
                            {job.tweet_id}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(job)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
                          {new Date(job.started_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
                          {job.stats.is_active ? (
                            <span className="text-green-400 font-medium">
                              {job.stats.hours_remaining}h {job.stats.minutes_remaining}m
                            </span>
                          ) : (
                            <span className="text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                          {job.stats.total_snapshots}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/monitor/${job.tweet_id}`}
                            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
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
          
          <div className="mt-6 text-center text-sm text-zinc-500">
            {activeJobs.length > 0 && (
              <p className="flex items-center justify-center gap-2">
                <span className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></span>
                Auto-refreshing every 30 seconds for active monitoring jobs
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

