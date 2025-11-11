'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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

  useEffect(() => {
    fetchTweetData();
  }, [tweetId, page, minFollowers, sortBy, engagementFilter, verifiedOnly]);

  const fetchTweetData = async () => {
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
    } catch (err) {
      setError('Failed to fetch tweet');
    } finally {
      setLoading(false);
    }
  };

  const getEngagementBadges = (engager: Engager) => {
    const badges = [];
    if (engager.replied) badges.push('💬 Replied');
    if (engager.retweeted) badges.push('🔁 Retweeted');
    if (engager.quoted) badges.push('💭 Quoted');
    return badges;
  };

  if (loading && !tweet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tweet data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <Link href="/tweets" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Back to Tweets
          </Link>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/tweets" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to all tweets
          </Link>
        </div>

        {/* Tweet Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {tweet?.author_name}
              </h1>
              <a
                href={tweet?.tweet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                View on Twitter →
              </a>
              <p className="text-sm text-gray-500 mt-2">
                Analyzed: {tweet?.created_at && new Date(tweet.created_at).toLocaleString()}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-lg font-semibold ${
              tweet?.status === 'completed' ? 'bg-green-100 text-green-800' :
              tweet?.status === 'analyzing' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {tweet?.status}
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Engagers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">&gt;10k Followers</p>
              <p className="text-2xl font-bold text-blue-600">{stats.above_10k}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">&lt;10k Followers</p>
              <p className="text-2xl font-bold text-gray-600">{stats.below_10k}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Max Score</p>
              <p className="text-2xl font-bold text-green-600">{stats.max_importance_score}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="importance_score">Importance Score</option>
                <option value="followers">Followers</option>
                <option value="username">Username</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Engagement Type
              </label>
              <select
                value={engagementFilter}
                onChange={(e) => {
                  setEngagementFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">All</option>
                <option value="replied">Replied</option>
                <option value="retweeted">Retweeted</option>
                <option value="quoted">Quoted</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="rounded border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Show only verified</span>
              </label>
            </div>
          </div>
        </div>

        {/* Engagers Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Followers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Engagement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Followed By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {engagers.map((engager) => (
                  <tr key={engager.userId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-bold text-green-600">
                        {engager.importance_score || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                            {engager.name}
                            {engager.verified && <span className="text-blue-500">✓</span>}
                          </div>
                          <div className="text-sm text-gray-500">@{engager.username}</div>
                          {engager.bio && (
                            <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                              {engager.bio}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {engager.followers.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {getEngagementBadges(engager).map((badge, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {engager.followed_by && engager.followed_by.length > 0 ? (
                        <div className="max-w-xs">
                          {engager.followed_by.slice(0, 3).join(', ')}
                          {engager.followed_by.length > 3 && ` +${engager.followed_by.length - 3} more`}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
                <span className="font-medium">{total}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

