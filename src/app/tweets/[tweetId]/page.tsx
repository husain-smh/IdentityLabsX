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

const CATEGORY_CONFIG: {
  key: CategoryKey;
  label: string;
  color: string;
}[] = [
  { key: 'founders', label: 'Founders', color: '#60a5fa' },
  { key: 'vcs', label: 'VCs', color: '#a78bfa' },
  { key: 'ai_creators', label: 'AI Creators', color: '#34d399' },
  { key: 'media', label: 'Media', color: '#3b82f6' },
  { key: 'developers', label: 'Developers', color: '#f472b6' },
  { key: 'c_level', label: 'C-Level', color: '#fbbf24' },
  { key: 'yc_alumni', label: 'YC Alumni', color: '#fb923c' },
  { key: 'others', label: 'Others', color: '#94a3b8' },
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Total Unique Engagers</p>
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
            </div>
          )}

          {tweet?.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {[
                { label: 'View Count', value: tweet.metrics.viewCount },
                { label: 'Reply Count', value: tweet.metrics.replyCount },
                { label: 'Like Count', value: tweet.metrics.likeCount },
                { label: 'Retweet Count', value: tweet.metrics.retweetCount },
                { label: 'Bookmark Count', value: tweet.metrics.bookmarkCount },
                { label: 'Quote Count', value: tweet.metrics.quoteCount },
              ].map(card => (
                <div key={card.label} className="glass rounded-xl p-4">
                  <p className="text-sm text-zinc-400">{card.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{card.value?.toLocaleString?.() ?? card.value ?? 0}</p>
                </div>
              ))}
            </div>
          )}

          {/* AI Report Section */}
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">AI Engagement Report</h3>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport || !tweetId}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {generatingReport ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {reportError}
              </div>
            )}

            {generatingReport && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent mx-auto"></div>
                <p className="mt-4 text-zinc-400">Analyzing engagers and generating report...</p>
                <p className="mt-2 text-sm text-zinc-500">This may take 10-30 seconds</p>
              </div>
            )}

            {aiReport && !generatingReport && (
              <div className="space-y-8">
                {/* Formatted Narrative Report */}
                <div className="bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setIsNarrativeOpen(!isNarrativeOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-900/50 transition-colors rounded-t-lg"
                  >
                    <h4 className="text-lg font-semibold text-white">Narrative Report</h4>
                    <svg
                      className={`w-5 h-5 text-zinc-400 transition-transform ${isNarrativeOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isNarrativeOpen && (
                    <div className="p-6">
                      {!aiReport.narrative || aiReport.narrative.trim().length === 0 ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="text-yellow-800 text-sm">
                            ⚠️ Report generated but narrative text is missing. Check console logs for details.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg p-8 shadow-lg border border-zinc-200">
                          <div className="font-mono text-black text-sm leading-relaxed">
                            <ReactMarkdown
                              components={{
                              // Style headings
                              h1: (props) => <h1 className="text-2xl font-bold text-black mb-4 mt-6 first:mt-0" {...props} />,
                              h2: (props) => <h2 className="text-xl font-bold text-black mb-3 mt-5 first:mt-0" {...props} />,
                              h3: (props) => <h3 className="text-lg font-bold text-black mb-2 mt-4 first:mt-0" {...props} />,
                              // Style paragraphs
                              p: (props) => <p className="text-black mb-3 last:mb-0" {...props} />,
                              // Style lists
                              ul: (props) => <ul className="list-disc list-outside ml-6 text-black mb-3 space-y-2" {...props} />,
                              ol: (props) => <ol className="list-decimal list-outside ml-6 text-black mb-3 space-y-2" {...props} />,
                              li: (props) => <li className="text-black" {...props} />,
                              // Style bold text
                              strong: (props) => <strong className="font-bold text-black" {...props} />,
                              // Style code
                              code: (props) => <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-black text-xs font-mono" {...props} />,
                            }}
                          >
                            {aiReport.narrative}
                          </ReactMarkdown>
                        </div>
                      </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Charts Section */}
                <div className="bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setIsChartsOpen(!isChartsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-900/50 transition-colors rounded-t-lg"
                  >
                    <h4 className="text-lg font-semibold text-white">Charts & Visualizations</h4>
                    <svg
                      className={`w-5 h-5 text-zinc-400 transition-transform ${isChartsOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isChartsOpen && (
                    <div className="p-6 space-y-6">
                  {/* Pie Chart - Category Breakdown with interactive details */}
                  {(() => {
                    const pieData = CATEGORY_CONFIG.map(cfg => ({
                      key: cfg.key,
                      name: cfg.label,
                      color: cfg.color,
                      value: aiReport.structured_stats.categories[cfg.key]?.count || 0,
                    })).filter(item => item.value > 0);

                    const activeCategory = selectedCategory && pieData.find(d => d.key === selectedCategory)
                      ? selectedCategory
                      : null;

                    const handleSliceClick = (_: any, index: number) => {
                      const clicked = pieData[index];
                      if (!clicked) return;
                      setSelectedCategory(prev => {
                        const newCategory = prev === clicked.key ? null : (clicked.key as CategoryKey);
                        // Reset displayed count when switching categories
                        if (newCategory !== prev) {
                          setDisplayedCount(20);
                        }
                        return newCategory;
                      });
                    };

                    // Get engagers for selected category and deduplicate by userId
                    const rawSelectedEngagers = activeCategory ? categorizedEngagers[activeCategory] ?? [] : [];
                    
                    // Deduplicate engagers by userId (in case same person appears multiple times)
                    const seenUserIds = new Set<string>();
                    const selectedEngagers = rawSelectedEngagers.filter((engager: Engager) => {
                      if (seenUserIds.has(engager.userId)) {
                        return false;
                      }
                      seenUserIds.add(engager.userId);
                      return true;
                    });
                    
                    // Get total count from pie chart data (all engagers)
                    const totalCountForCategory = activeCategory
                      ? pieData.find(d => d.key === activeCategory)?.value || 0
                      : 0;
                    
                    // Check if we're using full data or fallback (current page only)
                    const isUsingFullData = !!aiReport?.structured_stats?.categorized_engagers;
                    const isLimited = !isUsingFullData && displayedCount < totalCountForCategory;

                    return pieData.length > 0 ? (
                      <div
                        className={`bg-zinc-900/50 rounded-lg p-6 transition-all duration-200 ${
                          activeCategory ? 'lg:flex lg:items-start lg:gap-6' : ''
                        }`}
                      >
                        <div className={activeCategory ? 'lg:w-1/2' : ''}>
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <h4 className="text-lg font-semibold text-white">
                              Profile Type Distribution
                            </h4>
                            <button
                              type="button"
                              className="shrink-0 w-5 h-5 rounded-full border border-zinc-600 text-[10px] text-zinc-300 flex items-center justify-center hover:bg-zinc-800 hover:text-white"
                              title="One account can be in many groups (founder, VC, etc). This chart shows each group's share of all group labels, not unique people, so the slices always add up to 100%."
                            >
                              i
                            </button>
                          </div>
                          <p className="text-xs text-zinc-400 mb-4">
                            Click a segment to see the specific accounts in that category.
                          </p>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) =>
                                  `${name}: ${(percent * 100).toFixed(0)}%`
                                }
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                onClick={handleSliceClick}
                              >
                                {pieData.map((entry, index) => {
                                  const isActive =
                                    activeCategory && entry.key === activeCategory;
                                  return (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={entry.color}
                                      stroke={isActive ? '#e5e7eb' : '#000000'}
                                      strokeWidth={isActive ? 2 : 1}
                                      className="cursor-pointer"
                                    />
                                  );
                                })}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {activeCategory && (
                          <div className="mt-6 lg:mt-0 lg:w-1/2">
                            <h5 className="text-sm font-semibold text-white mb-2 flex items-center justify-between">
                              <span>
                                {CATEGORY_CONFIG.find(c => c.key === activeCategory)?.label}{' '}
                                {isLimited ? (
                                  <span className="text-zinc-400">
                                    ({displayedCount} shown of {totalCountForCategory} total)
                                  </span>
                                ) : (
                                  <span>({totalCountForCategory} accounts)</span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedCategory(null)}
                                className="text-xs text-zinc-400 hover:text-zinc-200 underline"
                              >
                                Clear
                              </button>
                            </h5>
                            {isLimited && (
                              <div className="mb-3 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-400">
                                ⚠️ Showing limited results. Regenerate the report to see all {totalCountForCategory} accounts in this category.
                              </div>
                            )}
                            {selectedEngagers.length === 0 ? (
                              <p className="text-xs text-zinc-500">
                                No accounts found in this category.
                              </p>
                            ) : (
                              <>
                                <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                                  {selectedEngagers
                                    .slice()
                                    .sort((a: Engager, b: Engager) => b.followers - a.followers)
                                    .slice(0, displayedCount)
                                    .map((engager: Engager, index: number) => (
                                      <div
                                        key={`${activeCategory}-${engager.userId}-${index}`}
                                        className="bg-zinc-900 rounded-md p-3 border border-zinc-800"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <div className="text-sm font-medium text-white flex items-center gap-1">
                                              {engager.name}
                                              {engager.verified && (
                                                <svg
                                                  className="w-4 h-4 text-indigo-400"
                                                  fill="currentColor"
                                                  viewBox="0 0 20 20"
                                                >
                                                  <path
                                                    fillRule="evenodd"
                                                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                    clipRule="evenodd"
                                                  />
                                                </svg>
                                              )}
                                            </div>
                                            <div className="text-xs text-zinc-400">
                                              @{engager.username}
                                            </div>
                                          </div>
                                          <div className="text-xs text-zinc-300 font-medium ml-4 whitespace-nowrap">
                                            {engager.followers.toLocaleString()}
                                          </div>
                                        </div>
                                        {engager.bio && (
                                          <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                                            {engager.bio}
                                          </p>
                                        )}
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          {getEngagementBadges(engager).map((badge, idx) => (
                                            <span
                                              key={idx}
                                              className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full"
                                            >
                                              {badge}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                                {displayedCount < selectedEngagers.length && (
                                  <button
                                    type="button"
                                    onClick={() => setDisplayedCount(prev => Math.min(prev + 20, selectedEngagers.length))}
                                    className="mt-3 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                                  >
                                    Show More ({Math.min(20, selectedEngagers.length - displayedCount)} more)
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}

                  {/* Bar Chart - Follower Tiers (stacked below) */}
                  {aiReport.structured_stats.follower_tiers &&
                    aiReport.structured_stats.follower_tiers.length > 0 && (
                      <div className="bg-zinc-900/50 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-white mb-4">
                          Follower Count Tiers
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={aiReport.structured_stats.follower_tiers}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="tier" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1f2937',
                                border: '1px solid #374151',
                                borderRadius: '8px',
                              }}
                              labelStyle={{ color: '#f3f4f6' }}
                            />
                            <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    </div>
                  )}
                </div>

                {/* VC Firms */}
                {aiReport.structured_stats.vc_firms && aiReport.structured_stats.vc_firms.length > 0 && (
                  <div className="bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => setIsVCFirmsOpen(!isVCFirmsOpen)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-900/50 transition-colors rounded-t-lg"
                    >
                      <h4 className="text-lg font-semibold text-white">VCs by Firm Affiliation</h4>
                      <svg
                        className={`w-5 h-5 text-zinc-400 transition-transform ${isVCFirmsOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isVCFirmsOpen && (
                      <div className="p-6">
                        <div className="space-y-4">
                          {aiReport.structured_stats.vc_firms.map((firm: any, idx: number) => (
                            <div key={idx} className="bg-zinc-900/50 rounded-lg p-4">
                              <h5 className="text-white font-semibold mb-3">{firm.firm_name}</h5>
                              <div className="space-y-2">
                                {firm.partners.map((partner: any, pIdx: number) => (
                                  <div key={pIdx} className="flex items-center justify-between text-sm">
                                    <div>
                                      <span className="text-white font-medium">{partner.name}</span>
                                      <span className="text-indigo-400 ml-2">@{partner.username}</span>
                                    </div>
                                    <span className="text-zinc-400">{(partner.followers / 1000).toFixed(1)}K followers</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Hardcoded VC Firms by Firm Affiliation */}
                {aiReport.structured_stats.hardcoded_vc_firms && aiReport.structured_stats.hardcoded_vc_firms.length > 0 && (
                  <div className="bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => setIsHardcodedVCFirmsOpen(!isHardcodedVCFirmsOpen)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-900/50 transition-colors rounded-t-lg"
                    >
                      <h4 className="text-lg font-semibold text-white">VCs by Firm Affiliation (Hardcoded)</h4>
                      <svg
                        className={`w-5 h-5 text-zinc-400 transition-transform ${isHardcodedVCFirmsOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isHardcodedVCFirmsOpen && (
                      <div className="p-6">
                        {(() => {
                          const firms = aiReport.structured_stats.hardcoded_vc_firms || [];
                          const pieData = firms.map((firm: any) => ({
                            name: firm.firm_name,
                            value: firm.partners.length,
                            firmName: firm.firm_name,
                          }));

                          const selectedFirmData = selectedVCFirm
                            ? firms.find((f: any) => f.firm_name === selectedVCFirm)
                            : null;

                          const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#fb923c', '#3b82f6'];

                          return pieData.length > 0 ? (
                            <div
                              className={`bg-zinc-900/50 rounded-lg p-6 transition-all duration-200 ${
                                selectedVCFirm ? 'lg:flex lg:items-start lg:gap-6' : ''
                              }`}
                            >
                              <div className={selectedVCFirm ? 'lg:w-1/2' : ''}>
                                <div className="flex items-center justify-between mb-2 gap-2">
                                  <h5 className="text-lg font-semibold text-white">
                                    Firm Distribution
                                  </h5>
                                </div>
                                <p className="text-xs text-zinc-400 mb-4">
                                  Click a segment to see the VCs/investors from that firm.
                                </p>
                                <ResponsiveContainer width="100%" height={300}>
                                  <PieChart>
                                    <Pie
                                      data={pieData}
                                      cx="50%"
                                      cy="50%"
                                      labelLine={false}
                                      label={({ name, percent }) =>
                                        `${name}: ${(percent * 100).toFixed(0)}%`
                                      }
                                      outerRadius={100}
                                      fill="#8884d8"
                                      dataKey="value"
                                      onClick={(_: any, index: number) => {
                                        const clicked = pieData[index];
                                        if (!clicked) return;
                                        setSelectedVCFirm(prev => 
                                          prev === clicked.firmName ? null : clicked.firmName
                                        );
                                      }}
                                    >
                                      {pieData.map((entry: any, index: number) => {
                                        const isActive = selectedVCFirm === entry.firmName;
                                        return (
                                          <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                            stroke={isActive ? '#e5e7eb' : '#000000'}
                                            strokeWidth={isActive ? 2 : 1}
                                            className="cursor-pointer"
                                          />
                                        );
                                      })}
                                    </Pie>
                                    <Tooltip />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>

                              {selectedVCFirm && selectedFirmData && (
                                <div className="mt-6 lg:mt-0 lg:w-1/2">
                                  <h5 className="text-sm font-semibold text-white mb-2 flex items-center justify-between">
                                    <span>
                                      {selectedFirmData.firm_name} ({selectedFirmData.partners.length} VC{selectedFirmData.partners.length !== 1 ? 's' : ''})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedVCFirm(null)}
                                      className="text-xs text-zinc-400 hover:text-zinc-200 underline"
                                    >
                                      Clear
                                    </button>
                                  </h5>
                                  {selectedFirmData.partners.length === 0 ? (
                                    <p className="text-xs text-zinc-500">
                                      No VCs/investors found in this firm.
                                    </p>
                                  ) : (
                                    <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                                      {selectedFirmData.partners
                                        .slice()
                                        .sort((a: any, b: any) => b.followers - a.followers)
                                        .map((partner: any, pIdx: number) => (
                                          <div
                                            key={`${selectedVCFirm}-${partner.username}-${pIdx}`}
                                            className="bg-zinc-900 rounded-md p-3 border border-zinc-800"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div>
                                                <div className="text-sm font-medium text-white flex items-center gap-1">
                                                  {partner.name}
                                                </div>
                                                <div className="text-xs text-zinc-400">
                                                  @{partner.username}
                                                </div>
                                              </div>
                                              <div className="text-xs text-zinc-300 font-medium ml-4 whitespace-nowrap">
                                                {partner.followers.toLocaleString()} followers
                                              </div>
                                            </div>
                                            {partner.bio && (
                                              <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                                                {partner.bio}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Quality Metrics */}
                <div className="bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setIsQualityMetricsOpen(!isQualityMetricsOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-900/50 transition-colors rounded-t-lg"
                  >
                    <h4 className="text-lg font-semibold text-white">Quality Metrics</h4>
                    <svg
                      className={`w-5 h-5 text-zinc-400 transition-transform ${isQualityMetricsOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isQualityMetricsOpen && (
                    <div className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                          <p className="text-sm text-zinc-400">Verified</p>
                          <p className="text-2xl font-bold text-emerald-400 mt-1">
                            {aiReport.structured_stats.quality_metrics?.verified_percentage || 0}%
                          </p>
                        </div>
                        <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                          <p className="text-sm text-zinc-400">Replied</p>
                          <p className="text-2xl font-bold text-blue-400 mt-1">
                            {aiReport.structured_stats.engagement.replied_percentage}%
                          </p>
                        </div>
                        <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                          <p className="text-sm text-zinc-400">Retweeted</p>
                          <p className="text-2xl font-bold text-indigo-400 mt-1">
                            {aiReport.structured_stats.engagement.retweeted_percentage}%
                          </p>
                        </div>
                        <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                          <p className="text-sm text-zinc-400">Top 10 Reach</p>
                          <p className="text-2xl font-bold text-purple-400 mt-1">
                            {(aiReport.structured_stats.quality_metrics?.top_10_followers_sum / 1000000).toFixed(2)}M+
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {aiReport.generated_at && (
                  <p className="text-xs text-zinc-500 text-right">
                    Generated: {new Date(aiReport.generated_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {!aiReport && !generatingReport && (
              <div className="text-center py-8 text-zinc-400">
                <p>No report generated yet. Click &quot;Generate Report&quot; to create an AI-powered analysis.</p>
              </div>
            )}
          </div>

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

