'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface EngagementData {
  author_name: string;
  tweet_url: string;
  spreadsheetId: string;
}

interface ExistingTweet {
  tweet_id: string;
  status: string;
  author_name: string;
  total_engagers: number;
  engagers_above_10k: number;
  engagers_below_10k: number;
  analyzed_at?: string;
  created_at: string;
  message: string;
}

export default function TwitterEngagement() {
  const router = useRouter();
  const [tweetUrl, setTweetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [engagementData, setEngagementData] = useState<EngagementData[] | null>(null);
  const [existingTweet, setExistingTweet] = useState<ExistingTweet | null>(null);
  const [showExistingModal, setShowExistingModal] = useState(false);
  const [isMonitoringLoading, setIsMonitoringLoading] = useState(false);
  const [, setPollingTweetId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to construct Google Sheets URL from spreadsheetId
  const constructSheetsUrl = (spreadsheetId: string) => {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  };

  const handleStartMonitoring = async () => {
    if (!tweetUrl.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter a Twitter URL'
      });
      return;
    }

    setIsMonitoringLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/monitor-tweet/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetUrl: tweetUrl.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.message || 'Monitoring started successfully! Metrics will be collected every 5 minutes for 72 hours.'
        });
        // Extract tweet ID and navigate to monitoring dashboard
        const tweetIdMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
        if (tweetIdMatch && tweetIdMatch[1]) {
          setTimeout(() => {
            router.push(`/monitor/${tweetIdMatch[1]}`);
          }, 1500);
        }
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to start monitoring'
        });
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Network error. Please check your connection and try again.'
      });
    } finally {
      setIsMonitoringLoading(false);
    }
  };

  // Polling function to check tweet status
  const pollTweetStatus = async (tweetId: string) => {
    try {
      const response = await fetch(`/api/tweets/${tweetId}`);
      const data = await response.json();

      if (data.success && data.tweet) {
        if (data.tweet.status === 'completed') {
          // Analysis complete - stop polling and navigate
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setPollingTweetId(null);
          setIsLoading(false);
          setMessage({
            type: 'success',
            text: 'Analysis completed successfully!'
          });
          // Navigate to tweet detail page
          router.push(`/tweets/${tweetId}`);
        } else if (data.tweet.status === 'failed') {
          // Analysis failed - stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setPollingTweetId(null);
          setIsLoading(false);
          setMessage({
            type: 'error',
            text: data.tweet.error || 'Analysis failed. Please try again.'
          });
        }
        // If still analyzing or pending, continue polling
      }
    } catch (error) {
      console.error('Error polling tweet status:', error);
      // On error, stop polling after a few attempts
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setPollingTweetId(null);
      setIsLoading(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleReanalyze = async () => {
    if (!tweetUrl.trim()) return;
    
    setShowExistingModal(false);
    setIsLoading(true);
    setMessage(null);
    setEngagementData(null);

    try {
      const response = await fetch('/api/tweets/analyze-native', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetUrl: tweetUrl.trim(), reanalyze: true }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Re-analysis started - begin polling
        const tweetId = data.tweet_id;
        setPollingTweetId(tweetId);
        setMessage({
          type: 'success',
          text: 'Re-analysis started! Processing in background. This may take a few minutes...'
        });

        // Start polling every 3 seconds
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        pollingIntervalRef.current = setInterval(() => {
          if (tweetId) {
            pollTweetStatus(tweetId);
          }
        }, 3000);

        // Initial poll
        pollTweetStatus(tweetId);
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to re-analyze tweet'
        });
        setIsLoading(false);
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Network error. Please try again.'
      });
      setIsLoading(false);
    }
  };

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
    setEngagementData(null);
    setShowExistingModal(false);

    try {
      const response = await fetch('/api/tweets/analyze-native', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetUrl: tweetUrl.trim() }),
      });

      const data = await response.json();

      // Check if tweet already exists
      if (data.already_exists) {
        setExistingTweet(data);
        setShowExistingModal(true);
        setIsLoading(false);
        return;
      }

      if (response.ok && data.success) {
        // Analysis started - begin polling
        const tweetId = data.tweet_id;
        setPollingTweetId(tweetId);
        setMessage({
          type: 'success',
          text: 'Analysis started! Processing in background. This may take a few minutes...'
        });

        // Start polling every 3 seconds
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        pollingIntervalRef.current = setInterval(() => {
          if (tweetId) {
            pollTweetStatus(tweetId);
          }
        }, 3000);

        // Initial poll
        pollTweetStatus(tweetId);
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to start analysis'
        });
        setIsLoading(false);
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Network error. Please check your connection and try again.'
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <Navbar />
      {/* Background Pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
      
      {/* Existing Tweet Modal */}
      {showExistingModal && existingTweet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-bold text-zinc-900">Tweet Already Analyzed</h3>
                <p className="text-sm text-zinc-500">{existingTweet.message}</p>
              </div>
              <button
                onClick={() => setShowExistingModal(false)}
                className="text-zinc-400 transition-colors hover:text-zinc-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6 space-y-2.5 rounded-xl bg-zinc-50 p-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Author:</span>
                <span className="font-medium text-zinc-900">{existingTweet.author_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Status:</span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                  existingTweet.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  existingTweet.status === 'analyzing' ? 'bg-amber-100 text-amber-700' :
                  existingTweet.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {existingTweet.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Total Engagers:</span>
                <span className="font-medium text-zinc-900">{existingTweet.total_engagers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">&gt;10k Followers:</span>
                <span className="font-medium text-indigo-600">{existingTweet.engagers_above_10k}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">&lt;10k Followers:</span>
                <span className="font-medium text-zinc-600">{existingTweet.engagers_below_10k}</span>
              </div>
              {existingTweet.analyzed_at && (
                <div className="flex justify-between items-center border-t border-zinc-200 pt-2 mt-2">
                  <span className="text-zinc-400 text-xs">Analyzed:</span>
                  <span className="text-zinc-400 text-xs">{new Date(existingTweet.analyzed_at).toLocaleString()}</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/tweets/${existingTweet.tweet_id}`)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Analysis
              </button>
              <button
                onClick={handleReanalyze}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 hover:border-zinc-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-analyze
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="relative z-10 origin-top-left scale-75" style={{ width: '133.33%', height: '133.33%' }}>
        {/* Header Section */}
        <div className="pt-20 pb-12">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 shadow-sm">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></div>
              <span className="text-xs font-medium text-zinc-500">Identity Labs Analytics</span>
            </div>
            
            <h1 className="mb-4 text-4xl font-semibold leading-tight text-zinc-900 md:text-5xl">
              Tweet Engagement
              <br />
              <span className="text-zinc-500">Analysis.</span>
            </h1>
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
                  Supports both twitter.com and x.com URLs. Paste full URL with /status/&lt;id&gt;
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading || !tweetUrl.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 text-base font-semibold text-white shadow-md transition-all hover:from-indigo-700 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                      Analyze Engagement
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleStartMonitoring}
                  disabled={isMonitoringLoading || !tweetUrl.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isMonitoringLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Starting...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    Start 72h Monitoring
                    </>
                  )}
                </button>
              </div>
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

          {/* Engagement Results Display */}
          {engagementData && engagementData.length > 0 && (
            <div className="space-y-4">
              {/* Results Header */}
              <div className="mb-6 text-center">
                <h2 className="mb-1 text-2xl font-bold text-zinc-900">engagement results:</h2>
                <p className="text-sm text-zinc-500">Comprehensive engagement analysis and data export</p>
              </div>

              {/* Engagement Data Cards */}
              <div className="space-y-3">
                {engagementData.map((item, index) => (
                  <div key={index} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        {/* Author Information */}
                        <div>
                          <h3 className="mb-1 text-lg font-semibold text-zinc-900">
                            Analysis for @{item.author_name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                            </svg>
                            <a 
                              href={item.tweet_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-700 hover:underline"
                            >
                              View Original Tweet
                            </a>
                          </div>
                        </div>

                        {/* Spreadsheet Link */}
                        <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="mb-0.5 font-medium text-zinc-900 text-sm">Engagement Data Export</h4>
                              <p className="text-xs text-zinc-500">
                                Complete engagement analysis exported to Google Sheets
                              </p>
                            </div>
                            <a
                              href={constructSheetsUrl(item.spreadsheetId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 transition-all"
                            >
                              <svg className="h-3.5 w-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                              </svg>
                              Open Spreadsheet
                              <svg className="h-3 w-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <div className="pt-6 text-center">
                <button
                  onClick={() => {
                    setEngagementData(null);
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

        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-zinc-200 py-6">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="text-xs text-zinc-400">
              Powered by Identity Labs • Advanced engagement analytics for content creators
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
