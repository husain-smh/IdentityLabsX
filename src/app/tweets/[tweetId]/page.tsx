'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface Engager {
  userId: string;
  username: string;
  name: string;
  bio?: string;
  location?: string;
  followers: number;
  verified: boolean;
  replied: boolean;
  retweeted: boolean;
  quoted: boolean;
  importance_score?: number;
  followed_by?: string[];
}

export default function TweetDetailPage() {
  const params = useParams();
  const tweetId = params?.tweetId as string;
  
  const [tweet, setTweet] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [engagers, setEngagers] = useState<Engager[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [minFollowers, setMinFollowers] = useState<string>('');
  const [sortBy, setSortBy] = useState('importance_score');
  const [engagementFilter, setEngagementFilter] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const limit = 50;

const fetchTweetData = useCallback(async () => {
  if (!tweetId) {
    return;
  }
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        include_engagers: 'true',
        limit: limit.toString(),
        skip: ((page - 1) * limit).toString(),
        sort_by: sortBy,
        sort_order: 'desc',
      });
      
      if (minFollowers) params.append('min_followers', minFollowers);
      if (engagementFilter) params.append('engagement_type', engagementFilter);
      if (verifiedOnly) params.append('verified_only', 'true');
      
      const res = await fetch(`/api/tweets/${tweetId}?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setTweet(data.tweet);
        setStats(data.stats);
        setEngagers(data.engagers.engagers);
        setTotal(data.engagers.total);
      } else {
        setError(data.error || 'Failed to fetch tweet');
      }
  } catch (_error) {
      setError('Failed to fetch tweet');
    } finally {
      setLoading(false);
    }
}, [tweetId, page, minFollowers, sortBy, engagementFilter, verifiedOnly]);

useEffect(() => {
  fetchTweetData();
}, [fetchTweetData]);

  const getEngagementBadges = (engager: Engager) => {
    const badges = [];
    if (engager.replied) badges.push('💬 Replied');
    if (engager.retweeted) badges.push('🔁 Retweeted');
    if (engager.quoted) badges.push('💭 Quoted');
    return badges;
  };

  if (loading && !tweet) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
        <div className="relative z-10 pt-20 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-zinc-400">Loading tweet data...</p>
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
            <Link href="/tweets" className="mt-4 inline-block px-4 py-2 gradient-primary text-white rounded-lg hover:opacity-90 transition-all">
              Back to Tweets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      
      <div className="relative z-10">
        {/* Header Section */}
        <div className="pt-24 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link href="/tweets" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm mb-6 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to all tweets
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          {/* Tweet Header */}
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white mb-2">
                  {tweet?.author_name}
                </h1>
                <a
                  href={tweet?.tweet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 hover:underline text-sm transition-colors"
                >
                  View on Twitter →
                </a>
                <p className="text-sm text-zinc-400 mt-2">
                  Analyzed: {tweet?.created_at && new Date(tweet.created_at).toLocaleString()}
                </p>
              </div>
              <div className={`px-4 py-2 rounded-full font-semibold text-sm border ${
                tweet?.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                tweet?.status === 'analyzing' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
              }`}>
                {tweet?.status}
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Total Engagers</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">&gt;10k Followers</p>
                <p className="text-2xl font-bold text-indigo-400 mt-1">{stats.above_10k}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">&lt;10k Followers</p>
                <p className="text-2xl font-bold text-zinc-300 mt-1">{stats.below_10k}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Max Score</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.max_importance_score}</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="glass rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Min Followers
                </label>
                <input
                  type="number"
                  value={minFollowers}
                  onChange={(e) => {
                    setMinFollowers(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. 10000"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                >
                  <option value="importance_score">Importance Score</option>
                  <option value="followers">Followers</option>
                  <option value="username">Username</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Engagement Type
                </label>
                <select
                  value={engagementFilter}
                  onChange={(e) => {
                    setEngagementFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                >
                  <option value="">All</option>
                  <option value="replied">Replied</option>
                  <option value="retweeted">Retweeted</option>
                  <option value="quoted">Quoted</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Verified Only
                </label>
                <label className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => {
                      setVerifiedOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 focus:ring-2"
                  />
                  <span className="ml-2 text-sm text-zinc-300">Show only verified</span>
                </label>
              </div>
            </div>
          </div>

          {/* Engagers Table */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Followers
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Engagement
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Followed By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {engagers.map((engager) => (
                    <tr key={engager.userId} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-emerald-400">
                          {engager.importance_score || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-white flex items-center gap-1">
                              {engager.name}
                              {engager.verified && (
                                <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="text-sm text-zinc-400">@{engager.username}</div>
                            {engager.bio && (
                              <div className="text-xs text-zinc-500 mt-1 max-w-xs truncate">
                                {engager.bio}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                        {engager.followers.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {getEngagementBadges(engager).map((badge, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded-full"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400">
                        {engager.followed_by && engager.followed_by.length > 0 ? (
                          <div className="max-w-xs">
                            {engager.followed_by.slice(0, 3).join(', ')}
                            {engager.followed_by.length > 3 && ` +${engager.followed_by.length - 3} more`}
                          </div>
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-zinc-900/50 border-t border-zinc-800 px-6 py-4 flex items-center justify-between">
                <div className="text-sm text-zinc-400">
                  Showing <span className="font-medium text-white">{(page - 1) * limit + 1}</span> to{' '}
                  <span className="font-medium text-white">{Math.min(page * limit, total)}</span> of{' '}
                  <span className="font-medium text-white">{total}</span> results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

