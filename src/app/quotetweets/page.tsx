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
    <div className="min-h-screen bg-black">
      <Navbar />
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      
      <div className="relative z-10">
        {/* Header Section */}
        <div className="pt-24 pb-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-zinc-400 text-sm font-medium">Identity Labs Analytics</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="gradient-text">Quote Tweet</span>
              <br />
              <span className="text-white">Analytics.</span>
            </h1>
            
            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Reverse-engineer viral content performance. Analyze quote tweet engagement 
              with precision-grade metrics that reveal true social impact.
            </p>
            
            <div className="flex flex-wrap justify-center gap-8 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>Real-time processing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>Deep engagement analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>Viral metrics tracking</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto px-6 pb-20">
          {/* Analytics Tool Card */}

          <div className="glass rounded-2xl p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label 
                  htmlFor="tweetUrl" 
                  className="block text-sm font-semibold text-white mb-3"
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
                    className="w-full px-6 py-4 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all text-lg"
                    disabled={isLoading}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                </div>
                <p className="mt-3 text-sm text-zinc-500">
                  Supports both twitter.com and x.com URLs
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !tweetUrl.trim()}
                className="w-full gradient-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-lg shadow-indigo-500/25"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Analyze Tweet
                  </>
                )}
              </button>
            </form>

            {/* Message Display */}
            {message && (
              <div className={`mt-6 p-4 rounded-xl border ${
                message.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                <div className="flex items-center gap-3">
                  {message.type === 'success' ? (
                    <div className="flex-shrink-0 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <span className="font-medium">{message.text}</span>
                </div>
              </div>
            )}

          </div>

          {/* Analytics Results Display */}
          {analyticsData && (
            <div className="space-y-6">
              {/* Main Results Header */}
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">results:</h2>
                <p className="text-zinc-400">Deep analytics for viral content performance</p>
              </div>

              {/* Key Metrics - Identity Labs Style */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="glass rounded-2xl p-6 text-center">
                  <div className="text-5xl font-bold text-white mb-2">
                    {analyticsData.totalQuoteTwtViews.toLocaleString()}
                  </div>
                  <div className="text-zinc-400 font-medium">
                    <span className="text-white font-bold">views</span>
                  </div>
                  <div className="text-sm text-zinc-500 mt-2">
                    Total quote tweet impressions
                  </div>
                </div>

                <div className="glass rounded-2xl p-6 text-center">
                  <div className="text-5xl font-bold text-white mb-2">
                    {analyticsData.totalUniqueUsers.toLocaleString()}
                  </div>
                  <div className="text-zinc-400 font-medium">
                    <span className="text-white font-bold">unique users</span>
                  </div>
                  <div className="text-sm text-zinc-500 mt-2">
                    Who quoted this tweet
                  </div>
                </div>
              </div>

              {/* Analysis Summary */}
              <div className="glass rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-2">Analysis Summary</h3>
                    <p className="text-zinc-400 leading-relaxed">
                      This tweet generated <span className="text-white font-semibold">{analyticsData.totalQuoteTwtViews.toLocaleString()} total views</span> across <span className="text-white font-semibold">{analyticsData.totalUniqueUsers.toLocaleString()} quote tweets</span> by unique users, demonstrating significant viral engagement potential.
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Processing Statistics */}
              {analyticsData.fullAnalytics?.statistics && (
                <div className="glass rounded-2xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Processing Details
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                      <div className="text-2xl font-bold text-white mb-1">
                        {analyticsData.fullAnalytics.statistics.totalTweetsProcessed.toLocaleString()}
                      </div>
                      <p className="text-zinc-400 text-sm">Tweets Processed</p>
                    </div>
                    
                    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                      <div className="text-2xl font-bold text-white mb-1">
                        {analyticsData.fullAnalytics.statistics.duplicatesRemoved.toLocaleString()}
                      </div>
                      <p className="text-zinc-400 text-sm">Duplicates Removed</p>
                    </div>
                    
                    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                      <div className="text-2xl font-bold text-white mb-1">
                        {analyticsData.fullAnalytics.statistics.processingTimeSeconds}s
                      </div>
                      <p className="text-zinc-400 text-sm">Processing Time</p>
                    </div>
                    
                    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                      <div className="text-2xl font-bold text-white mb-1">
                        {analyticsData.fullAnalytics.statistics.deduplicationRate}%
                      </div>
                      <p className="text-zinc-400 text-sm">Dedup Rate</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Quote Tweet Users */}
              {analyticsData.fullAnalytics?.filteredUsers && analyticsData.fullAnalytics.filteredUsers.length > 0 && (
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <svg className="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      Top Influencers
                    </h3>
                    <span className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20">
                      Top {Math.min(25, analyticsData.fullAnalytics.filteredUsers.length)}
                    </span>
                  </div>
                  
                  <div className="space-y-4 max-h-[800px] overflow-y-auto">
                    {analyticsData.fullAnalytics.filteredUsers
                      .sort((a, b) => b.totalViewsFromQuoteTweets - a.totalViewsFromQuoteTweets)
                      .slice(0, 25)
                      .map((user, index) => (
                        <div key={user.userId} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-white font-bold">
                              #{index + 1}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-white truncate">
                                {user.name || 'Unknown User'}
                              </p>
                              {user.verified && (
                                <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <p className="text-sm text-zinc-400">
                              @{user.username || 'unknown'} • {user.followers.toLocaleString()} followers
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-2xl font-bold text-white">
                              {user.totalViewsFromQuoteTweets.toLocaleString()}
                            </p>
                            <p className="text-xs text-zinc-500">views</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="text-center pt-8">
                <button
                  onClick={() => {
                    setAnalyticsData(null);
                    setMessage(null);
                  }}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-semibold rounded-xl transition-all"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Analyze Another Tweet
                </button>
              </div>
            </div>
          )}
          {/* How it Works Section */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-white mb-8">How it works:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">1</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Copy URL</h3>
                <p className="text-zinc-400 text-sm">Get any Twitter/X tweet URL from the share button</p>
              </div>
              
              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">2</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Paste & Analyze</h3>
                <p className="text-zinc-400 text-sm">Input the URL and click analyze for deep insights</p>
              </div>
              
              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">3</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Get Metrics</h3>
                <p className="text-zinc-400 text-sm">Receive comprehensive quote tweet analytics</p>
              </div>
              
              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">4</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Optimize</h3>
                <p className="text-zinc-400 text-sm">Use insights to improve your viral content strategy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 py-8 border-t border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-zinc-500 text-sm">
              Powered by Identity Labs • Advanced analytics for viral content creators
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

