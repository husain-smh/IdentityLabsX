'use client';

import { useEffect, useState } from 'react';
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

export default function TweetsPage() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTweets();
    
    // Auto-refresh every 10 seconds if there are analyzing tweets
    const interval = setInterval(() => {
      if (tweets.some(t => t.status === 'analyzing' || t.status === 'pending')) {
        fetchTweets();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [tweets]);

  const fetchTweets = async () => {
    try {
      const res = await fetch('/api/tweets');
      const data = await res.json();
      
      if (data.success) {
        setTweets(data.tweets);
      } else {
        setError(data.error || 'Failed to fetch tweets');
      }
    } catch (err) {
      setError('Failed to fetch tweets');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-gray-200 text-gray-700',
      analyzing: 'bg-blue-200 text-blue-700',
      completed: 'bg-green-200 text-green-700',
      failed: 'bg-red-200 text-red-700',
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tweets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <button
            onClick={fetchTweets}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tweet Analytics</h1>
          <p className="mt-2 text-gray-600">
            View and analyze Twitter engagement data
          </p>
        </div>

        {tweets.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No tweets analyzed yet.</p>
            <p className="text-gray-400 mt-2">
              Start by triggering the n8n workflow with a tweet URL.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tweet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engagers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tweets.map((tweet) => (
                  <tr key={tweet.tweet_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <a
                        href={tweet.tweet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                      >
                        {tweet.tweet_id}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {tweet.author_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(tweet.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {tweet.total_engagers} total
                      </div>
                      <div className="text-xs text-gray-500">
                        {tweet.engagers_above_10k} &gt;10k | {tweet.engagers_below_10k} &lt;10k
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tweet.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {tweet.status === 'completed' ? (
                        <Link
                          href={`/tweets/${tweet.tweet_id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details →
                        </Link>
                      ) : tweet.status === 'analyzing' ? (
                        <span className="text-gray-400">Analyzing...</span>
                      ) : tweet.status === 'failed' ? (
                        <span className="text-red-600">Failed</span>
                      ) : (
                        <span className="text-gray-400">Pending...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="mt-4 text-center text-sm text-gray-500">
          {tweets.some(t => t.status === 'analyzing' || t.status === 'pending') && (
            <p className="flex items-center justify-center gap-2">
              <span className="animate-pulse">●</span>
              Auto-refreshing every 10 seconds for analyzing tweets
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
