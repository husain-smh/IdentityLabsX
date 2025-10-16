'use client';

import { useState } from 'react';
import Link from 'next/link';

interface EngagementData {
  author_name: string;
  tweet_url: string;
  spreadsheetId: string;
}

export default function TwitterEngagement() {
  const [tweetUrl, setTweetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [engagementData, setEngagementData] = useState<EngagementData[] | null>(null);

  // Function to construct Google Sheets URL from spreadsheetId
  const constructSheetsUrl = (spreadsheetId: string) => {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
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

    try {
      const response = await fetch('/api/twtengagement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetUrl: tweetUrl.trim() }),
      });

      const data = await response.json();

      // Frontend logging for debugging
      console.log('=== FRONTEND DEBUG INFO ===');
      console.log('API Response Status:', response.status);
      console.log('API Response Data:', JSON.stringify(data, null, 2));
      console.log('Data Type:', typeof data);
      console.log('Data Keys:', Object.keys(data));
      if (data.data) {
        console.log('data.data:', JSON.stringify(data.data, null, 2));
        console.log('data.data Type:', typeof data.data);
        console.log('data.data Is Array:', Array.isArray(data.data));
      }
      console.log('=== END FRONTEND DEBUG ===');

      if (response.ok) {
        // Extract sheetdata from the response
        // Handle different response formats from the API
        let sheetData = null;
        
        if (data.data && data.data.sheetdata) {
          // Format: { data: { sheetdata: [...] } } - This is what we're getting
          sheetData = data.data.sheetdata;
        } else if (data.data && Array.isArray(data.data) && data.data[0] && data.data[0].sheetdata) {
          // Format: { data: [{ sheetdata: [...] }] }
          sheetData = data.data[0].sheetdata;
        } else if (Array.isArray(data) && data[0] && data[0].sheetdata) {
          // Format: [{ sheetdata: [...] }]
          sheetData = data[0].sheetdata;
        } else if (data.sheetdata) {
          // Format: { sheetdata: [...] }
          sheetData = data.sheetdata;
        }
        
        console.log('Extracted sheetData:', sheetData);

        if (sheetData && Array.isArray(sheetData) && sheetData.length > 0) {
          setEngagementData(sheetData);
          setMessage({
            type: 'success',
            text: 'Engagement analysis complete! Here are your results:'
          });
        } else {
          setMessage({
            type: 'success',
            text: 'Analysis completed, but no engagement data was found. This tweet may not have sufficient engagement activity to analyze.'
          });
        }
        setTweetUrl(''); // Clear the input
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to analyze tweet engagement'
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
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      
      {/* Navigation Button */}
      <div className="absolute top-6 right-6 z-20">
        <Link href="/">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-800 hover:border-zinc-600 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Quote Tweet Analytics
          </button>
        </Link>
      </div>
      
      <div className="relative z-10">
        {/* Header Section */}
        <div className="pt-20 pb-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-zinc-400 text-sm font-medium">Identity Labs Analytics</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="gradient-text">Tweet Engagement</span>
              <br />
              <span className="text-white">Analysis.</span>
            </h1>
            
            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Deep-dive into tweet engagement patterns. Analyze user interactions, 
              engagement metrics, and export comprehensive data to Google Sheets.
            </p>
            
            <div className="flex flex-wrap justify-center gap-8 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>Engagement tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>User interaction analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>Google Sheets export</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto px-6 pb-20">
          {/* Important Notes */}
          <div className="glass rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-6 h-6 bg-yellow-500/20 border border-yellow-500/30 rounded flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.59c.75 1.334-.213 2.987-1.743 2.987H3.482c-1.53 0-2.493-1.653-1.743-2.987l6.518-11.59zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-lg">Important notes</h3>
            </div>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 text-sm">
              <li>
                Ensure the account&apos;s sheet exists in your Google Spreadsheet (
                <a
                  href="https://docs.google.com/spreadsheets/d/1Ejt2mOL-uwZ5iu-fGhDten4Du0Hy8t3BFQMJSJA-h2s/edit?gid=0#gid=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  open spreadsheet
                </a>
                ). If a sheet with the exact account name does not exist, create one and copy the header
                row (first row) from an existing sheet into it.
              </li>
              <li>
                The workflow takes time to process. You&apos;ll see a loading state — please be patient.
              </li>
              <li>
                After completion, you&apos;ll receive a Google Spreadsheet link that you can open to view the
                results.
              </li>
              <li>
                Provide the complete Tweet URL, including the full path like /status/123456789...
              </li>
            </ul>
          </div>
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
                <p className="mt-1 text-sm text-zinc-500">
                  Tip: Paste the full Tweet URL that contains /status/&lt;tweet-id&gt;
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
                    Analyzing Engagement...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    Analyze Engagement
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

          {/* Engagement Results Display */}
          {engagementData && engagementData.length > 0 && (
            <div className="space-y-6">
              {/* Results Header */}
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">engagement results:</h2>
                <p className="text-zinc-400">Comprehensive engagement analysis and data export</p>
              </div>

              {/* Engagement Data Cards */}
              <div className="space-y-4">
                {engagementData.map((item, index) => (
                  <div key={index} className="glass rounded-2xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        {/* Author Information */}
                        <div>
                          <h3 className="text-white font-semibold text-lg mb-2">
                            Analysis for @{item.author_name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                            </svg>
                            <a 
                              href={item.tweet_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              View Original Tweet
                            </a>
                          </div>
                        </div>

                        {/* Spreadsheet Link */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-white font-medium mb-1">Engagement Data Export</h4>
                              <p className="text-sm text-zinc-400">
                                Complete engagement analysis exported to Google Sheets
                              </p>
                            </div>
                            <a
                              href={constructSheetsUrl(item.spreadsheetId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 gradient-primary text-white font-medium rounded-lg hover:opacity-90 transition-all"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                              </svg>
                              Open Spreadsheet
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="text-center pt-8">
                <button
                  onClick={() => {
                    setEngagementData(null);
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
                <h3 className="text-white font-semibold mb-2">Analyze Engagement</h3>
                <p className="text-zinc-400 text-sm">Input the URL and click analyze for engagement insights</p>
              </div>
              
              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">3</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Export Data</h3>
                <p className="text-zinc-400 text-sm">Get comprehensive data exported to Google Sheets</p>
              </div>
              
              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">4</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Optimize Strategy</h3>
                <p className="text-zinc-400 text-sm">Use engagement insights to improve your content strategy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 py-8 border-t border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-zinc-500 text-sm">
              Powered by Identity Labs • Advanced engagement analytics for content creators
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
