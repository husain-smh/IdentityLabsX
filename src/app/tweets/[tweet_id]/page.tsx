'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
  importance_score: number;
  followed_by_usernames: string[];
}

export default function TweetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tweet_id = params.tweet_id as string;

  const [tweet, setTweet] = useState<Tweet | null>(null);
  const [engagers, setEngagers] = useState<Engager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [followerFilter, setFollowerFilter] = useState<'all' | 'above10k' | 'below10k'>('all');
  const [sortBy, setSortBy] = useState<'importance_score' | 'followers'>('importance_score');
  const [engagementFilter, setEngagementFilter] = useState<string>('all');

  useEffect(() => {
    fetchTweetDetails();
  }, [tweet_id, followerFilter, sortBy, engagementFilter]);

  const fetchTweetDetails = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder: 'desc',
        limit: '100',
      });

      if (followerFilter === 'above10k') {
        params.set('minFollowers', '10000');
      } else if (followerFilter === 'below10k') {
        params.set('maxFollowers', '9999');
      }

      if (engagementFilter !== 'all') {
        params.set('engagementType', engagementFilter);
      }

      const response = await fetch(`/api/tweets/${tweet_id}?${params}`);
      const data = await response.json();

      if (data.success) {
        setTweet(data.data.tweet);
        setEngagers(data.data.engagers);
      } else {
        setError('Failed to load tweet details');
      }
    } catch (err) {
      setError('Error loading tweet details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !tweet) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-gray-600">Loading tweet details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tweet) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            {error || 'Tweet not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/tweets" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to all tweets
          </Link>
          <h1 className="text-3xl font-bold">{tweet.author_name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span>Status: <span className="font-semibold">{tweet.status}</span></span>
            <span>Total Engagers: <span className="font-semibold">{tweet.total_engagers}</span></span>
            <a
              href={tweet.tweet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              View Tweet →
            </a>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Total Engagers</div>
            <div className="text-2xl font-bold mt-2">{tweet.total_engagers}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">&gt;10k Followers</div>
            <div className="text-2xl font-bold mt-2 text-green-600">{tweet.engagers_above_10k}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">&lt;10k Followers</div>
            <div className="text-2xl font-bold mt-2 text-blue-600">{tweet.engagers_below_10k}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Follower Count
              </label>
              <select
                value={followerFilter}
                onChange={(e) => setFollowerFilter(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="above10k">&gt;10k followers</option>
                <option value="below10k">&lt;10k followers</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="importance_score">Importance Score</option>
                <option value="followers">Followers</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Engagement Type
              </label>
              <select
                value={engagementFilter}
                onChange={(e) => setEngagementFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="replied">Replied</option>
                <option value="retweeted">Retweeted</option>
                <option value="quoted">Quoted</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchTweetDetails}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Engagers Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            </div>
          ) : engagers.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              No engagers found with current filters.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Score
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
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            <a
                              href={`https://x.com/${engager.username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-600"
                            >
                              @{engager.username}
                            </a>
                            {engager.verified && (
                              <span className="text-blue-500">✓</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{engager.name}</div>
                          {engager.bio && (
                            <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                              {engager.bio}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        {engager.importance_score}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {engager.followers.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {engager.replied && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Replied
                          </span>
                        )}
                        {engager.retweeted && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            RT
                          </span>
                        )}
                        {engager.quoted && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            Quoted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {engager.followed_by_usernames.length > 0 ? (
                        <div className="text-xs text-gray-600">
                          {engager.followed_by_usernames.slice(0, 3).join(', ')}
                          {engager.followed_by_usernames.length > 3 && (
                            <span className="text-gray-400">
                              {' '}+{engager.followed_by_usernames.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600 text-center">
          Showing {engagers.length} engagers
        </div>
      </div>
    </div>
  );
}

