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
        if (data.data && data.data.totalQuoteTwtViews !== undefined && data.data.totalUniqueUsers !== undefined) {
          setAnalyticsData({
            totalQuoteTwtViews: data.data.totalQuoteTwtViews,
            totalUniqueUsers: data.data.totalUniqueUsers,
            fullAnalytics: data.data.fullAnalytics
          });
          setMessage({
            type: 'success',
            text: 'Analysis complete.'
          });
        } else {
          setMessage({
            type: 'success',
            text: 'Processing request...'
          });
        }
        setTweetUrl('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to send tweet URL'
        });
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Network error. Please check your connection.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-[#4A4A4A] font-serif">
      <Navbar />

      <main className="relative pt-32 pb-20 px-6">
        {/* Header Section */}
        <div className="max-w-[800px] mx-auto text-center mb-16">
          <h1 className="text-[2.5rem] leading-[1.3] font-normal mb-6 text-[#4A4A4A]">
            Quote Tweets
          </h1>
          
          <p className="text-[1.125rem] leading-[1.75] text-[#6B6B6B] max-w-[65ch] mx-auto">
            Analyze quote tweet engagement.
          </p>
        </div>

        {/* Input Section */}
        <div className="max-w-[650px] mx-auto mb-20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="tweetUrl" 
                className="block text-sm text-[#4A4A4A] mb-2 font-normal"
              >
                Tweet URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  id="tweetUrl"
                  value={tweetUrl}
                  onChange={(e) => setTweetUrl(e.target.value)}
                  placeholder="https://x.com/..."
                  className="w-full px-4 py-3 bg-white border border-[#E0DDD8] rounded-sm text-[#4A4A4A] placeholder-[#6B6B6B]/50 focus:border-[#8B8680] focus:outline-none transition-colors text-base font-serif"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !tweetUrl.trim()}
              className="w-full bg-white text-[#4A4A4A] border border-[#E0DDD8] hover:bg-[#F5F3F0] hover:underline disabled:opacity-50 disabled:cursor-not-allowed py-3 px-6 rounded-sm transition-all text-base"
            >
              {isLoading ? 'Analyzing...' : 'Analyze Tweet'}
            </button>
          </form>

          {/* Message Display */}
          {message && (
            <div className={`mt-6 p-4 border rounded-sm text-sm ${
              message.type === 'success' 
                ? 'border-[#E0DDD8] text-[#4A4A4A] bg-white' 
                : 'border-red-200 text-red-600 bg-white'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Analytics Results Display */}
        {analyticsData && (
          <div className="max-w-[1000px] mx-auto space-y-12">
            
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[#E0DDD8] pt-12">
              <div className="text-center">
                <div className="text-[3.5rem] leading-[1.2] font-normal text-[#4A4A4A] mb-2">
                  {analyticsData.totalQuoteTwtViews.toLocaleString()}
                </div>
                <div className="text-[#6B6B6B] text-sm uppercase tracking-wide">
                  Total Views
                </div>
              </div>

              <div className="text-center">
                <div className="text-[3.5rem] leading-[1.2] font-normal text-[#4A4A4A] mb-2">
                  {analyticsData.totalUniqueUsers.toLocaleString()}
                </div>
                <div className="text-[#6B6B6B] text-sm uppercase tracking-wide">
                  Unique Users
                </div>
              </div>
            </div>

            {/* Detailed Stats */}
            {analyticsData.fullAnalytics?.statistics && (
              <div className="bg-white border border-[#E0DDD8] p-8 rounded-sm">
                <h3 className="text-[1.5rem] leading-[1.5] font-normal text-[#4A4A4A] mb-8 text-center">
                  Processing Statistics
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <div className="text-center">
                    <div className="text-xl text-[#4A4A4A] mb-1">
                      {analyticsData.fullAnalytics.statistics.totalTweetsProcessed.toLocaleString()}
                    </div>
                    <p className="text-[#6B6B6B] text-sm">Processed</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xl text-[#4A4A4A] mb-1">
                      {analyticsData.fullAnalytics.statistics.duplicatesRemoved.toLocaleString()}
                    </div>
                    <p className="text-[#6B6B6B] text-sm">Duplicates</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xl text-[#4A4A4A] mb-1">
                      {analyticsData.fullAnalytics.statistics.processingTimeSeconds}s
                    </div>
                    <p className="text-[#6B6B6B] text-sm">Time</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xl text-[#4A4A4A] mb-1">
                      {analyticsData.fullAnalytics.statistics.deduplicationRate}%
                    </div>
                    <p className="text-[#6B6B6B] text-sm">Dedup Rate</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top Users Table */}
            {analyticsData.fullAnalytics?.filteredUsers && analyticsData.fullAnalytics.filteredUsers.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-[1.5rem] leading-[1.5] font-normal text-[#4A4A4A] text-center">
                  Top Influencers
                </h3>
                
                <div className="bg-white border border-[#E0DDD8] rounded-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#F5F3F0] text-[#6B6B6B] text-sm uppercase tracking-wide border-b border-[#E0DDD8]">
                        <tr>
                          <th className="px-6 py-4 font-normal">Rank</th>
                          <th className="px-6 py-4 font-normal">User</th>
                          <th className="px-6 py-4 font-normal text-right">Followers</th>
                          <th className="px-6 py-4 font-normal text-right">Views</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0DDD8]">
                        {analyticsData.fullAnalytics.filteredUsers
                          .sort((a, b) => b.totalViewsFromQuoteTweets - a.totalViewsFromQuoteTweets)
                          .slice(0, 25)
                          .map((user, index) => (
                            <tr key={user.userId} className="hover:bg-[#F5F3F0]/50 transition-colors">
                              <td className="px-6 py-4 text-[#6B6B6B]">
                                #{index + 1}
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-[#4A4A4A]">
                                  {user.name || 'Unknown'}
                                </div>
                                <div className="text-sm text-[#6B6B6B]">
                                  @{user.username || 'unknown'}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-[#4A4A4A]">
                                {user.followers.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-right font-medium text-[#4A4A4A]">
                                {user.totalViewsFromQuoteTweets.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center pt-12">
              <button
                onClick={() => {
                  setAnalyticsData(null);
                  setMessage(null);
                }}
                className="text-[#4A4A4A] border-b border-[#4A4A4A] hover:border-transparent transition-colors pb-1"
              >
                Analyze Another Tweet
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
