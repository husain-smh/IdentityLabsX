'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';

export default function QuoteTweets() {
  const [tweetUrl, setTweetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    totalQuoteTwtViews: string;
    totalUniqueUsers: string;
    fullAnalytics?: {
      success: boolean;
      statistics: {
        totalInputItems: number;
        totalPages: number;
        totalTweetsProcessed: number;
        totalUsersExtracted: number;
        totalUsersFiltered: number;
        uniqueUsersKept: number;
        duplicatesRemoved: number;
        deduplicationRate: number;
        totalViewsAcrossAllQuoteTweets: number;
        processingTimeMs: number;
        processingTimeSeconds: number;
        errorCount: number;
      };
      filteredUsers: Array<{
        userId: string;
        username: string | null;
        name: string | null;
        verified: boolean;
        followers: number;
        bio: string | null;
        location: string | null;
        totalViewsFromQuoteTweets: number;
      }>;
      errors: string[];
    };
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tweetUrl.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter a Twitter URL'
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setAnalyticsData(null);

    try {
      const response = await fetch('/api/send-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetUrl: tweetUrl.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        // Check if we have analytics data in the response
        if (data.data && data.data.totalQuoteTwtViews !== undefined && data.data.totalUniqueUsers !== undefined) {
          setAnalyticsData({
            totalQuoteTwtViews: data.data.totalQuoteTwtViews,
            totalUniqueUsers: data.data.totalUniqueUsers,
            fullAnalytics: data.data.fullAnalytics
          });
          setMessage({
            type: 'success',
            text: 'Analysis complete! Here are your comprehensive tweet analytics:'
          });
        } else {
          setMessage({
            type: 'success',
            text: 'Tweet URL sent successfully! Processing your request...'
          });
        }
        setTweetUrl(''); // Clear the input
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to send tweet URL'
        });
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Network error. Please check your connection and try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <Navbar />
      {/* Background Pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>

      <div className="relative z-10 origin-top-left scale-75" style={{ width: '133.33%', height: '133.33%' }}>
        {/* Header Section */}
        <div className="pt-20 pb-12">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 shadow-sm">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></div>
              <span className="text-xs font-medium text-zinc-500">Identity Labs Analytics</span>
            </div>

            <h1 className="mb-4 text-4xl font-semibold leading-tight text-zinc-900 md:text-5xl">
              Quote Tweet
              <br />
              <span className="text-zinc-500">Analytics.</span>
            </h1>

            <p className="mx-auto max-w-xl text-lg text-zinc-500 leading-relaxed">
              Reverse-engineer viral content performance. Analyze quote tweet engagement 
              with precision-grade metrics that reveal true social impact.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-zinc-400">
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-zinc-300"></div>
                <span>Real-time processing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-zinc-300"></div>
                <span>Deep engagement analysis</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-zinc-300"></div>
                <span>Viral metrics tracking</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-3xl px-6 pb-16">
          {/* Analytics Tool Card */}
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label 
                  htmlFor="tweetUrl" 
                  className="mb-2 block text-sm font-semibold text-zinc-900"
                >
                  Tweet URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    id="tweetUrl"
                    value={tweetUrl}
                    onChange={(e) => setTweetUrl(e.target.value)}
                    placeholder="https://x.com/username/status/123456789..."
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                    disabled={isLoading}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  Supports both twitter.com and x.com URLs
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !tweetUrl.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Analyze Tweet
                  </>
                )}
              </button>
            </form>

            {/* Message Display */}
            {message && (
              <div className={`mt-4 rounded-xl border p-3 ${
                message.type === 'success' 
                  ? 'border-emerald-500/20 bg-emerald-50 text-emerald-600' 
                  : 'border-red-500/20 bg-red-50 text-red-600'
              }`}>
                <div className="flex items-center gap-2">
                  {message.type === 'success' ? (
                    <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500">
                      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-500">
                      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <span className="text-sm font-medium">{message.text}</span>
                </div>
              </div>
            )}
          </div>

          {/* Analytics Results Display */}
          {analyticsData && (
            <div className="space-y-4">
              {/* Main Results Header */}
              <div className="mb-6 text-center">
                <h2 className="mb-1 text-2xl font-semibold text-zinc-900">results:</h2>
                <p className="text-sm text-zinc-500">Deep analytics for viral content performance</p>
              </div>

              {/* Key Metrics - Dark Glass Style for Emphasis */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center shadow-lg backdrop-blur-sm">
                  <div className="mb-1 text-4xl font-bold text-white">
                    {analyticsData.totalQuoteTwtViews.toLocaleString()}
                  </div>
                  <div className="font-medium text-zinc-400">
                    <span className="font-semibold text-white">views</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Total quote tweet impressions
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center shadow-lg backdrop-blur-sm">
                  <div className="mb-1 text-4xl font-bold text-white">
                    {analyticsData.totalUniqueUsers.toLocaleString()}
                  </div>
                  <div className="font-medium text-zinc-400">
                    <span className="font-semibold text-white">unique users</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Who quoted this tweet
                  </div>
                </div>
              </div>

              {/* Analysis Summary */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-zinc-900">Analysis Summary</h3>
                    <p className="text-sm leading-relaxed text-zinc-500">
                      This tweet generated <span className="font-semibold text-zinc-900">{analyticsData.totalQuoteTwtViews.toLocaleString()} total views</span> across <span className="font-semibold text-zinc-900">{analyticsData.totalUniqueUsers.toLocaleString()} quote tweets</span> by unique users, demonstrating significant viral engagement potential.
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Processing Statistics */}
              {analyticsData.fullAnalytics?.statistics && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-zinc-900">
                    <svg className="h-4 w-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Processing Details
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="mb-0.5 text-xl font-bold text-zinc-900">
                        {analyticsData.fullAnalytics.statistics.totalTweetsProcessed.toLocaleString()}
                      </div>
                      <p className="text-xs text-zinc-500">Tweets Processed</p>
                    </div>
                    
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="mb-0.5 text-xl font-bold text-zinc-900">
                        {analyticsData.fullAnalytics.statistics.duplicatesRemoved.toLocaleString()}
                      </div>
                      <p className="text-xs text-zinc-500">Duplicates Removed</p>
                    </div>
                    
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="mb-0.5 text-xl font-bold text-zinc-900">
                        {analyticsData.fullAnalytics.statistics.processingTimeSeconds}s
                      </div>
                      <p className="text-xs text-zinc-500">Processing Time</p>
                    </div>
                    
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="mb-0.5 text-xl font-bold text-zinc-900">
                        {analyticsData.fullAnalytics.statistics.deduplicationRate}%
                      </div>
                      <p className="text-xs text-zinc-500">Dedup Rate</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Quote Tweet Users */}
              {analyticsData.fullAnalytics?.filteredUsers && analyticsData.fullAnalytics.filteredUsers.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
                      <svg className="h-4 w-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      Top Influencers
                    </h3>
                    <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                      Top {Math.min(25, analyticsData.fullAnalytics.filteredUsers.length)}
                    </span>
                  </div>
                  
                  <div className="max-h-[600px] space-y-3 overflow-y-auto">
                    {analyticsData.fullAnalytics.filteredUsers
                      .sort((a, b) => b.totalViewsFromQuoteTweets - a.totalViewsFromQuoteTweets)
                      .slice(0, 25)
                      .map((user, index) => (
                        <div key={user.userId} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                          <div className="flex-shrink-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 font-bold text-white text-sm">
                              #{index + 1}
                            </div>
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-1.5">
                              <p className="truncate font-semibold text-zinc-900 text-sm">
                                {user.name || 'Unknown User'}
                              </p>
                              {user.verified && (
                                <svg className="h-3 w-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">
                              @{user.username || 'unknown'} • {user.followers.toLocaleString()} followers
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-lg font-bold text-zinc-900">
                              {user.totalViewsFromQuoteTweets.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-zinc-500">views</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-6 text-center">
                <button
                  onClick={() => {
                    setAnalyticsData(null);
                    setMessage(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 hover:ring-zinc-300"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Analyze Another Tweet
                </button>
              </div>
            </div>
          )}

          {/* How it Works Section */}
          <div className="mt-12 text-center">
            <h2 className="mb-6 text-xl font-semibold text-zinc-900">How it works:</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((step, idx) => {
                const titles = ["Copy URL", "Paste & Analyze", "Get Metrics", "Optimize"];
                const descriptions = [
                  "Get any Twitter/X tweet URL from the share button",
                  "Input the URL and click analyze for deep insights",
                  "Receive comprehensive quote tweet analytics",
                  "Use insights to improve your viral content strategy",
                ];
                return (
                  <div key={step} className="rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm">
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                      {step}
                    </div>
                    <h3 className="mb-1 text-sm font-semibold text-zinc-900">{titles[idx]}</h3>
                    <p className="text-xs text-zinc-500">{descriptions[idx]}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-zinc-200 py-6">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="text-xs text-zinc-400">
              Powered by Identity Labs • Advanced analytics for viral content creators
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
