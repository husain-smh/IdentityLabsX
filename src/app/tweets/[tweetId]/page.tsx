'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';

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

type CategoryKey =
  | 'founders'
  | 'vcs'
  | 'ai_creators'
  | 'media'
  | 'developers'
  | 'c_level'
  | 'yc_alumni'
  | 'others';

// Design.json palette mapping
const CATEGORY_CONFIG: {
  key: CategoryKey;
  label: string;
  color: string;
}[] = [
  { key: 'founders', label: 'Founders', color: '#4D4DFF' }, // primary.vibrantBlue
  { key: 'vcs', label: 'VCs', color: '#C4B5FD' }, // secondary.lightPurple
  { key: 'ai_creators', label: 'AI Creators', color: '#10B981' }, // semantic.success
  { key: 'media', label: 'Media', color: '#3B82F6' }, // Blue
  { key: 'developers', label: 'Developers', color: '#F472B6' }, // Pink
  { key: 'c_level', label: 'C-Level', color: '#FBBF24' }, // Amber
  { key: 'yc_alumni', label: 'YC Alumni', color: '#FB923C' }, // Orange
  { key: 'others', label: 'Others', color: '#9CA3AF' }, // textTertiary
];

export default function TweetDetailPage() {
  const params = useParams();
  const tweetId = params?.tweetId as string;
  
  const [tweet, setTweet] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [engagers, setEngagers] = useState<Engager[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // AI Report state
  const [aiReport, setAiReport] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  
  // Collapsible sections state
  const [isNarrativeOpen, setIsNarrativeOpen] = useState(true);
  const [isChartsOpen, setIsChartsOpen] = useState(true);
  const [isVCFirmsOpen, setIsVCFirmsOpen] = useState(true);
  const [isHardcodedVCFirmsOpen, setIsHardcodedVCFirmsOpen] = useState(true);
  const [isQualityMetricsOpen, setIsQualityMetricsOpen] = useState(true);
  
  // Selected firm for hardcoded VC firms pie chart
  const [selectedVCFirm, setSelectedVCFirm] = useState<string | null>(null);
  
  // Filters
  const [minFollowers, setMinFollowers] = useState<string>('');
  const [sortBy, setSortBy] = useState('importance_score');
  const [engagementFilter, setEngagementFilter] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const limit = 50;

  // CSV Export state
  const [exporting, setExporting] = useState(false);

  // Interactive category selection for charts
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  // Pagination for categorized engagers list
  const [displayedCount, setDisplayedCount] = useState(20);

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
        // Set AI report if it exists
        if (data.tweet?.ai_report) {
          setAiReport(data.tweet.ai_report);
        }
      } else {
        setError(data.error || 'Failed to fetch tweet');
      }
    } catch {
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

  // Local categorization helper (mirrors backend `categorizeEngager`)
  const categorizeEngagerProfile = (engager: Engager): CategoryKey[] => {
    const bio = (engager.bio || '').toLowerCase();
    const name = (engager.name || '').toLowerCase();
    const username = (engager.username || '').toLowerCase();

    const combined = `${bio} ${name} ${username}`;
    const categories: CategoryKey[] = [];

    // YC alumni
    const ycKeywords = ['y combinator', 'yc s', 'yc w', 'yc ', 'ycombinator'];
    if (ycKeywords.some(kw => combined.includes(kw))) {
      categories.push('yc_alumni');
    }

    // C-Level (but not explicit founders/CEOs)
    const cLevelKeywords = ['cto', 'cfo', 'coo', 'chief technology', 'chief financial', 'chief operating'];
    if (cLevelKeywords.some(kw => combined.includes(kw)) && !combined.includes('founder') && !combined.includes('ceo')) {
      categories.push('c_level');
    }

    // Founders / CEOs
    const founderKeywords = [
      'founder',
      'co-founder',
      'cofounder',
      'ceo',
      'chief executive',
      'startup founder',
      'company founder',
    ];
    if (founderKeywords.some(kw => combined.includes(kw))) {
      categories.push('founders');
    }

    // VCs / Investors
    const vcKeywords = [
      'vc',
      'venture capital',
      'venture capitalist',
      'investor',
      'angel investor',
      'a16z',
      'andreessen horowitz',
      'partner at',
      'investment partner',
      'venture partner',
      'seed fund',
      'series a',
      'series b',
      'series c',
      'portfolio',
      'backed by',
    ];
    if (vcKeywords.some(kw => combined.includes(kw))) {
      categories.push('vcs');
    }

    // AI Creators
    const aiCreatorKeywords = [
      'ai content creator',
      'ai influencer',
      'ai writer',
      'ai educator',
      'newsletter',
      'ai newsletter',
      'building in ai',
      'ai builder',
      'ai creator',
      'ai content',
      'generative ai',
      'llm',
      'chatgpt',
      'ai researcher',
      'ai practitioner',
      'llm',
    ];
    if (aiCreatorKeywords.some(kw => combined.includes(kw))) {
      categories.push('ai_creators');
    }

    // Media
    const mediaKeywords = [
      'journalist',
      'reporter',
      'media',
      'press',
      'writer',
      'editor',
      'tech journalist',
      'tech reporter',
      'news',
      'publication',
      'techcrunch',
      'the verge',
      'wired',
      'forbes',
      'bloomberg',
    ];
    if (mediaKeywords.some(kw => combined.includes(kw))) {
      categories.push('media');
    }

    // Developers
    const developerKeywords = [
      'developer',
      'engineer',
      'software engineer',
      'programmer',
      'coder',
      'building',
      'builder',
      'full stack',
      'backend',
      'frontend',
      'dev',
      'tech lead',
      'senior engineer',
      'principal engineer',
    ];
    if (developerKeywords.some(kw => combined.includes(kw))) {
      categories.push('developers');
    }

    if (categories.length === 0) {
      categories.push('others');
    }

    return categories;
  };

  // Get categorized engagers from AI report (all engagers) or fallback to current page
  const categorizedEngagers = useMemo(() => {
    // If AI report has categorized engagers, use those (includes ALL engagers)
    if (aiReport?.structured_stats?.categorized_engagers) {
      // Convert CategorizedEngager to Engager-compatible format
      const convert = (e: any): Engager => ({
        userId: e.userId,
        username: e.username,
        name: e.name,
        bio: e.bio,
        followers: e.followers,
        verified: e.verified,
        replied: e.replied,
        retweeted: e.retweeted,
        quoted: e.quoted,
        importance_score: e.importance_score,
      });

      return {
        founders: (aiReport.structured_stats.categorized_engagers.founders || []).map(convert),
        vcs: (aiReport.structured_stats.categorized_engagers.vcs || []).map(convert),
        ai_creators: (aiReport.structured_stats.categorized_engagers.ai_creators || []).map(convert),
        media: (aiReport.structured_stats.categorized_engagers.media || []).map(convert),
        developers: (aiReport.structured_stats.categorized_engagers.developers || []).map(convert),
        c_level: (aiReport.structured_stats.categorized_engagers.c_level || []).map(convert),
        yc_alumni: (aiReport.structured_stats.categorized_engagers.yc_alumni || []).map(convert),
        others: (aiReport.structured_stats.categorized_engagers.others || []).map(convert),
      };
    }

    // Fallback: Pre-categorize currently loaded engagers (for backwards compatibility)
    const initial: Record<CategoryKey, Engager[]> = {
      founders: [],
      vcs: [],
      ai_creators: [],
      media: [],
      developers: [],
      c_level: [],
      yc_alumni: [],
      others: [],
    };

    for (const engager of engagers) {
      const cats = categorizeEngagerProfile(engager);
      for (const cat of cats) {
        initial[cat].push(engager);
      }
    }

    return initial;
  }, [aiReport, engagers]);

  const handleGenerateReport = async () => {
    if (!tweetId) return;
    
    setGeneratingReport(true);
    setReportError(null);
    
    try {
      const res = await fetch(`/api/tweets/${tweetId}/generate-report`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (data.success) {
        console.log('[Frontend] Report received:', {
          hasNarrative: !!data.report?.narrative,
          narrativeLength: data.report?.narrative?.length || 0,
          hasStructuredStats: !!data.report?.structured_stats,
        });
        setAiReport(data.report);
        // Refresh tweet data to get updated report
        await fetchTweetData();
      } else {
        setReportError(data.error || 'Failed to generate report');
      }
    } catch (err) {
      setReportError('Failed to generate report. Please try again.');
      console.error('Error generating report:', err);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading && !tweet) {
    return (
      <div className="relative min-h-screen bg-white text-zinc-900">
        <Navbar />
        <div className="flex min-h-screen items-center justify-center pt-20">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-zinc-500">Loading tweet data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen bg-white text-zinc-900">
        <Navbar />
        <div className="flex min-h-screen items-center justify-center pt-20">
          <div className="text-center">
            <p className="text-lg text-red-500">{error}</p>
            <Link href="/tweets" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500">
              Back to Tweets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <Navbar />
      {/* Background Pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
      
      <div className="relative z-10 origin-top-left scale-75" style={{ width: '133.33%', height: '133.33%' }}>
        {/* Header Section */}
        <div className="pt-20 pb-8">
          <div className="mx-auto max-w-5xl px-6">
            <Link href="/tweets" className="mb-4 inline-flex items-center gap-2 text-sm text-indigo-500 transition-colors hover:text-indigo-600 hover:underline">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to all tweets
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 pb-16">
          {/* Tweet Header - Scaled */}
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="mb-2 text-xl font-bold text-zinc-900">
                  {tweet?.author_name}
                </h1>
                <a
                  href={tweet?.tweet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-500 transition-colors hover:text-indigo-600 hover:underline"
                >
                  View on Twitter →
                </a>
                <p className="mt-2 text-xs text-zinc-500">
                  Analyzed: {tweet?.created_at && new Date(tweet.created_at).toLocaleString()}
                </p>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                tweet?.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                tweet?.status === 'analyzing' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                'border-yellow-200 bg-yellow-50 text-yellow-700'
              }`}>
                {tweet?.status}
              </div>
            </div>
          </div>

          {/* Stats - Scaled & Themed */}
          {stats && (
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-zinc-500">Total Unique Engagers</p>
                <p className="mt-1 text-xl font-bold text-zinc-900">{stats.total.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-zinc-500">&gt;10k Followers</p>
                <p className="mt-1 text-xl font-bold text-indigo-600">{stats.above_10k.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-zinc-500">&lt;10k Followers</p>
                <p className="mt-1 text-xl font-bold text-zinc-700">{stats.below_10k.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Metrics Collapsible Section - Dark Glass */}
          {tweet?.metrics && (
            <details className="group mb-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg backdrop-blur-sm" open>
              <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-white hover:bg-white/5">
                <span className="text-sm font-semibold uppercase tracking-wide text-indigo-300">Engagement Metrics</span>
                <svg className="h-5 w-5 text-zinc-500 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: 'Views', value: tweet.metrics.viewCount },
                  { label: 'Replies', value: tweet.metrics.replyCount },
                  { label: 'Likes', value: tweet.metrics.likeCount },
                  { label: 'Retweets', value: tweet.metrics.retweetCount },
                  { label: 'Bookmarks', value: tweet.metrics.bookmarkCount },
                  { label: 'Quotes', value: tweet.metrics.quoteCount },
                ].map(card => (
                  <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-zinc-400">{card.label}</p>
                    <p className="mt-1 text-xl font-bold text-white">{card.value?.toLocaleString?.() ?? card.value ?? 0}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* AI Report Section - Light Card */}
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">AI Engagement Report</h3>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport || !tweetId}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                {generatingReport ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Generating...
                  </>
                ) : aiReport ? (
                  'Regenerate Report'
                ) : (
                  'Generate Report'
                )}
              </button>
            </div>

            {reportError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                {reportError}
              </div>
            )}

            {generatingReport && (
              <div className="py-8 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                <p className="mt-2 text-xs text-zinc-500">Analyzing engagers...</p>
              </div>
            )}

            {aiReport && !generatingReport && (
              <div className="space-y-6">
                {/* Formatted Narrative Report */}
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                  <button
                    onClick={() => setIsNarrativeOpen(!isNarrativeOpen)}
                    className="flex w-full items-center justify-between bg-zinc-100 p-4 text-left transition-colors hover:bg-zinc-200/50"
                  >
                    <h4 className="text-sm font-semibold text-zinc-900">Narrative Analysis</h4>
                    <svg className={`h-4 w-4 text-zinc-500 transition-transform ${isNarrativeOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isNarrativeOpen && (
                    <div className="p-6">
                      {!aiReport.narrative ? (
                        <p className="text-xs text-yellow-600">No narrative text available.</p>
                      ) : (
                        <div className="prose prose-sm max-w-none text-zinc-700 prose-headings:font-semibold prose-headings:text-zinc-900 prose-strong:text-zinc-900 prose-code:text-zinc-800 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                          <ReactMarkdown>{aiReport.narrative}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Charts Section */}
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                  <button
                    onClick={() => setIsChartsOpen(!isChartsOpen)}
                    className="flex w-full items-center justify-between bg-zinc-100 p-4 text-left transition-colors hover:bg-zinc-200/50"
                  >
                    <h4 className="text-sm font-semibold text-zinc-900">Visualizations</h4>
                    <svg className={`h-4 w-4 text-zinc-500 transition-transform ${isChartsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isChartsOpen && (
                    <div className="space-y-6 p-6">
                      {/* Pie Chart */}
                      {(() => {
                        const pieData = CATEGORY_CONFIG.map(cfg => ({
                          key: cfg.key,
                          name: cfg.label,
                          color: cfg.color,
                          value: aiReport.structured_stats.categories[cfg.key]?.count || 0,
                        })).filter(item => item.value > 0);

                        return pieData.length > 0 ? (
                          <div className="rounded-xl border border-zinc-200 bg-white p-4">
                            <h5 className="mb-4 text-sm font-semibold text-zinc-900">Profile Distribution</h5>
                            <div className="h-[300px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                  >
                                    {pieData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #E4E4E7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#18181B' }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="mt-4 flex flex-wrap justify-center gap-3">
                              {pieData.map((entry) => (
                                <div key={entry.key} className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="text-xs text-zinc-600">{entry.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Filters - Light Card */}
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Filters</h3>
              <button
                onClick={async () => {
                  if (!tweetId || exporting) return;
                  setExporting(true);
                  try {
                    const params = new URLSearchParams({
                      include_engagers: 'true',
                      limit: '10000',
                      skip: '0',
                      sort_by: sortBy,
                      sort_order: 'desc',
                    });
                    if (minFollowers) params.append('min_followers', minFollowers);
                    if (engagementFilter) params.append('engagement_type', engagementFilter);
                    if (verifiedOnly) params.append('verified_only', 'true');
                    
                    const res = await fetch(`/api/tweets/${tweetId}?${params}`);
                    const data = await res.json();
                    
                    if (!data.success || !data.engagers?.engagers) {
                      alert('Failed to fetch engagers for export');
                      return;
                    }
                    
                    const allEngagers: Engager[] = data.engagers.engagers;
                    const headers = ['Score', 'Username', 'Name', 'Bio', 'Followers', 'Verified', 'Replied', 'Retweeted', 'Quoted', 'Followed By'];
                    const escapeCSV = (value: string | undefined | null) => {
                      if (value === undefined || value === null) return '';
                      const str = String(value);
                      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                      }
                      return str;
                    };
                    
                    const rows = allEngagers.map(engager => [
                      engager.importance_score || 0,
                      escapeCSV(engager.username),
                      escapeCSV(engager.name),
                      escapeCSV(engager.bio),
                      engager.followers,
                      engager.verified ? 'Yes' : 'No',
                      engager.replied ? 'Yes' : 'No',
                      engager.retweeted ? 'Yes' : 'No',
                      engager.quoted ? 'Yes' : 'No',
                      escapeCSV(engager.followed_by?.join(', '))
                    ]);
                    
                    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', `engagers-${tweetId}-${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('Export failed:', err);
                    alert('Failed to export engagers. Please try again.');
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-800"
              >
                {exporting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </>
                )}
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Min Followers</label>
                <input
                  type="number"
                  value={minFollowers}
                  onChange={(e) => {
                    setMinFollowers(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. 10000"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>
              
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                >
                  <option value="importance_score">Importance Score</option>
                  <option value="followers">Followers</option>
                  <option value="username">Username</option>
                </select>
              </div>
              
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Engagement Type</label>
                <select
                  value={engagementFilter}
                  onChange={(e) => {
                    setEngagementFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                >
                  <option value="">All</option>
                  <option value="replied">Replied</option>
                  <option value="retweeted">Retweeted</option>
                  <option value="quoted">Quoted</option>
                </select>
              </div>
              
              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => {
                      setVerifiedOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-zinc-600">Verified only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Engagers Table - Light Table */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-3 backdrop-blur-sm">
              <div className="grid grid-cols-[80px_1fr_100px_140px_120px] gap-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <div>Score</div>
                <div>User</div>
                <div>Followers</div>
                <div>Action</div>
                <div>Followed By</div>
              </div>
            </div>
            
            <div className="divide-y divide-zinc-100">
              {engagers.map((engager) => (
                <div key={engager.userId} className="grid grid-cols-[80px_1fr_100px_140px_120px] items-center gap-4 px-6 py-4 text-sm hover:bg-zinc-50">
                  <div className="font-bold text-emerald-600">
                    {engager.importance_score?.toFixed(1) || '0.0'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-zinc-900">{engager.name}</span>
                      {engager.verified && (
                        <svg className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">@{engager.username}</div>
                    {engager.bio && (
                      <div className="mt-1 truncate text-xs text-zinc-400">{engager.bio}</div>
                    )}
                  </div>
                  <div className="font-medium text-zinc-700">
                    {engager.followers.toLocaleString()}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {getEngagementBadges(engager).map((badge, idx) => (
                      <span key={idx} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 border border-indigo-100">
                        {badge}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {engager.followed_by && engager.followed_by.length > 0 ? (
                      <span className="truncate block" title={engager.followed_by.join(', ')}>
                        {engager.followed_by.slice(0, 2).join(', ')}
                        {engager.followed_by.length > 2 && ` +${engager.followed_by.length - 2}`}
                      </span>
                    ) : (
                      <span className="text-zinc-300">-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                <div className="text-xs text-zinc-500">
                  Page <span className="font-medium text-zinc-900">{page}</span> of <span className="font-medium text-zinc-900">{totalPages}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-white"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-white"
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
