'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Bell } from 'lucide-react';
import {
  ComposedChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardData {
  campaign: any;
  metrics: {
    total_likes: number;
    total_retweets: number;
    total_quotes: number;
    total_replies: number;
    total_views: number;
    total_quote_views?: number;
    total_engagements: number;
    unique_engagers: number;
  };
  latest_engagements: any[];
  category_breakdown: Record<string, number>;
  category_totals?: {
    main_twt: CategoryMetrics;
    influencer_twt: CategoryMetrics;
    investor_twt: CategoryMetrics;
  };
  tweets?: Array<{
    tweet_id: string;
    category: 'main_twt' | 'influencer_twt' | 'investor_twt';
    author_username: string;
    metrics?: {
      likeCount: number;
      retweetCount: number;
      quoteCount: number;
      replyCount: number;
      viewCount: number;
      quoteViewsFromQuotes?: number;
    };
  }>;
}

type CategoryMetrics = {
  likes: number;
  retweets: number;
  quotes: number;
  replies: number;
  views: number;
  quote_views?: number;
};

const COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#3b82f6', '#f472b6', '#fbbf24', '#fb923c', '#94a3b8'];
const REFRESH_INTERVAL_MS = 180_000; // 3 minutes
const CHART_BLUE = '#3b82f6';

type FilterType = 'all' | 'main_twt' | 'influencer_twt' | 'investor_twt';

type MetricKey =
  | 'likes'
  | 'retweets'
  | 'quotes'
  | 'replies'
  | 'views'
  | 'quoteViews'
  | 'second_order_retweets'
  | 'second_order_replies';

type SecondDegreePoint = {
  time: string;
  views: number;
  likes: number;
  retweets: number;
  replies: number;
  second_order_retweets: number;
  second_order_replies: number;
};

type SecondDegreeTotals = {
  views: number;
  likes: number;
  retweets: number;
  replies: number;
  second_order_retweets: number;
  second_order_replies: number;
};

interface MetricChartProps {
  title: string;
  metric: MetricKey;
  chartData: Array<{ time: string; [key: string]: any }>;
  color: string;
}

function MetricChart({ title, metric, chartData }: Omit<MetricChartProps, 'filter' | 'onFilterChange'>) {
  // Custom tooltip to show cumulative value and delta
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const cumulativeValue = payload[0].value;
      const delta = data.delta !== undefined ? data.delta : null;

      return (
        <div
          style={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '12px',
          }}
        >
          <p style={{ color: '#f3f4f6', marginBottom: '8px', fontWeight: 'bold' }}>
            {label}
          </p>
          <p style={{ color: CHART_BLUE, marginBottom: '4px' }}>
            {title}: <strong>{cumulativeValue?.toLocaleString()}</strong>
          </p>
          {delta !== null && (
            <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>
              Δ (this period): <strong style={{ color: delta >= 0 ? '#34d399' : '#f87171' }}>
                {delta >= 0 ? '+' : ''}{delta.toLocaleString()}
              </strong>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Determine if the chart spans multiple calendar days so we can decide
  // whether to show date + time or just time on the X-axis.
  const isMultiDay = (() => {
    if (!chartData || chartData.length === 0) return false;
    const first = new Date(chartData[0].time);
    const last = new Date(chartData[chartData.length - 1].time);
    if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) {
      return false;
    }
    return (
      first.getFullYear() !== last.getFullYear() ||
      first.getMonth() !== last.getMonth() ||
      first.getDate() !== last.getDate()
    );
  })();

  // Format X-axis ticks to avoid clutter when there are many data points.
  // We keep all data points (for accurate lines and tooltips) but only label
  // a subset of them on the axis, with enough context to distinguish days.
  const formatXAxisTick = (value: string, index: number) => {
    if (!chartData || chartData.length === 0) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const maxTicks = 8;
    const step = Math.max(1, Math.ceil(chartData.length / maxTicks));

    // Only show a label for every `step`-th point to space them out.
    if (index % step !== 0) {
      return '';
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (isMultiDay) {
      // Short date + time, e.g. "11/28 05:00"
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}/${day} ${hours}:${minutes}`;
    }

    // Single-day range: time-only is enough.
    return `${hours}:${minutes}`;
  };

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id={`grad-${metric}-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_BLUE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART_BLUE} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              tickFormatter={formatXAxisTick}
              tickLine={false}
            />
            <YAxis stroke="#9ca3af" />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={CHART_BLUE}
              strokeWidth={2.5}
              fill={`url(#grad-${metric}-${title})`}
              dot={{ r: 2, strokeWidth: 1 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center text-zinc-400 py-12">
          No metrics data yet
        </div>
      )}
    </div>
  );
}

export default function CampaignDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsData, setMetricsData] = useState<any[]>([]);
  const [engagementSeries, setEngagementSeries] = useState<
    Array<{
      time: string;
      timeRaw?: Date;
      retweets: number;
      replies: number;
      quotes: number;
      total: number;
      retweetsDelta: number;
      repliesDelta: number;
      quotesDelta: number;
      totalDelta: number;
    }>
  >([]);
  const [engagementLastUpdated, setEngagementLastUpdated] = useState<Date | null>(null);

  // Category-scoped engagement series (main and influencer)
  const [mainEngagementSeries, setMainEngagementSeries] = useState<typeof engagementSeries>([]);
  const [influencerEngagementSeries, setInfluencerEngagementSeries] = useState<typeof engagementSeries>([]);
  const [mainEngagementLastUpdated, setMainEngagementLastUpdated] = useState<Date | null>(null);
  const [influencerEngagementLastUpdated, setInfluencerEngagementLastUpdated] = useState<Date | null>(null);

  // Second-degree metrics (quote tweets + second-order engagements)
  const [secondDegreeSeries, setSecondDegreeSeries] = useState<{
    main_twt: SecondDegreePoint[];
    influencer_twt: SecondDegreePoint[];
    investor_twt: SecondDegreePoint[];
  }>({
    main_twt: [],
    influencer_twt: [],
    investor_twt: [],
  });
  const [secondDegreeTotals, setSecondDegreeTotals] = useState<{
    main_twt: SecondDegreeTotals;
    influencer_twt: SecondDegreeTotals;
    investor_twt: SecondDegreeTotals;
  }>({
    main_twt: {
      views: 0,
      likes: 0,
      retweets: 0,
      replies: 0,
      second_order_retweets: 0,
      second_order_replies: 0,
    },
    influencer_twt: {
      views: 0,
      likes: 0,
      retweets: 0,
      replies: 0,
      second_order_retweets: 0,
      second_order_replies: 0,
    },
    investor_twt: {
      views: 0,
      likes: 0,
      retweets: 0,
      replies: 0,
      second_order_retweets: 0,
      second_order_replies: 0,
    },
  });
  
  // Single global filter state for all charts
  const [globalFilter, setGlobalFilter] = useState<'all' | 'main_twt' | 'influencer_twt' | 'investor_twt'>('all');
  
// Action type filter for engagements
const [actionTypeFilter, setActionTypeFilter] = useState<'all' | 'retweet' | 'reply' | 'quote'>('all');

// Engagement pagination (API-backed)
const [engagements, setEngagements] = useState<any[]>([]);
const [engagementLimit] = useState(50);
const [hasMoreEngagements, setHasMoreEngagements] = useState(true);
const [isLoadingEngagements, setIsLoadingEngagements] = useState(false);
const [isLoadingMoreEngagements, setIsLoadingMoreEngagements] = useState(false);
const [isMetricsLoading, setIsMetricsLoading] = useState(false);
const [isEngagementSeriesLoading, setIsEngagementSeriesLoading] = useState(false);
const [isSecondDegreeLoading, setIsSecondDegreeLoading] = useState(false);
const engagementOffsetRef = useRef(0);

  // Track which people have expanded actions (show all vs show top 3)
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/socap/campaigns/${campaignId}/dashboard`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const fetchMetrics = useCallback(async () => {
    setIsMetricsLoading(true);
    try {
      const response = await fetch(
        `/api/socap/campaigns/${campaignId}/metrics?granularity=hour`
      );
      const result = await response.json();
      
      if (result.success) {
        setMetricsData(result.data.snapshots || []);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setIsMetricsLoading(false);
    }
  }, [campaignId]);

  // Helper to transform engagement points into cumulative series with deltas
  const mapEngagementSeries = (points: Array<{ time: string | Date; retweets?: number; replies?: number; quotes?: number; total?: number }>) => {
    const sortedPoints = [...points].sort((a, b) => {
      const timeA = new Date(a.time).getTime();
      const timeB = new Date(b.time).getTime();
      return timeA - timeB;
    });

    let cumulativeRetweets = 0;
    let cumulativeReplies = 0;
    let cumulativeQuotes = 0;
    let cumulativeTotal = 0;

    const mapped = sortedPoints.map((p) => {
      cumulativeRetweets += p.retweets ?? 0;
      cumulativeReplies += p.replies ?? 0;
      cumulativeQuotes += p.quotes ?? 0;
      cumulativeTotal += p.total ?? 0;

      return {
        time: new Date(p.time).toLocaleString(),
        timeRaw: new Date(p.time),
        retweets: cumulativeRetweets,
        replies: cumulativeReplies,
        quotes: cumulativeQuotes,
        total: cumulativeTotal,
        retweetsDelta: p.retweets ?? 0,
        repliesDelta: p.replies ?? 0,
        quotesDelta: p.quotes ?? 0,
        totalDelta: p.total ?? 0,
      };
    });

    const firstNonZeroIndex = mapped.findIndex((point) => {
      const hasRetweets = (point.retweets ?? 0) > 0;
      const hasReplies = (point.replies ?? 0) > 0;
      const hasQuotes = (point.quotes ?? 0) > 0;
      const hasTotal = (point.total ?? 0) > 0;
      return hasRetweets || hasReplies || hasQuotes || hasTotal;
    });

    return firstNonZeroIndex > 0 ? mapped.slice(firstNonZeroIndex) : mapped;
  };

  const fetchEngagementSeries = useCallback(async () => {
    setIsEngagementSeriesLoading(true);
    try {
      const response = await fetch(
        `/api/socap/campaigns/${campaignId}/engagements/timeseries?granularity=half_hour`
      );
      const result = await response.json();

      if (result.success) {
        const points = (result.data?.points || []) as Array<{
          time: string | Date;
          retweets?: number;
          replies?: number;
          quotes?: number;
          total?: number;
        }>;

        const trimmedSeries = mapEngagementSeries(points);

        setEngagementSeries(trimmedSeries);
        
        // Store last updated timestamp if available
        if (result.data?.last_updated) {
          setEngagementLastUpdated(new Date(result.data.last_updated));
        } else {
          setEngagementLastUpdated(null);
        }
      }
    } catch (error) {
      console.error('Error fetching engagement time series:', error);
    } finally {
      setIsEngagementSeriesLoading(false);
    }
  }, [campaignId]);

  const fetchCategoryEngagementSeries = useCallback(
    async (category: 'main_twt' | 'influencer_twt') => {
      try {
        const response = await fetch(
          `/api/socap/campaigns/${campaignId}/engagements/timeseries?granularity=half_hour&category=${category}`
        );
        const result = await response.json();

        if (result.success) {
          const points = (result.data?.points || []) as Array<{
            time: string | Date;
            retweets?: number;
            replies?: number;
            quotes?: number;
            total?: number;
          }>;

          const trimmedSeries = mapEngagementSeries(points);

          if (category === 'main_twt') {
            setMainEngagementSeries(trimmedSeries);
            setMainEngagementLastUpdated(result.data?.last_updated ? new Date(result.data.last_updated) : null);
          } else {
            setInfluencerEngagementSeries(trimmedSeries);
            setInfluencerEngagementLastUpdated(result.data?.last_updated ? new Date(result.data.last_updated) : null);
          }
        }
      } catch (error) {
        console.error(`Error fetching ${category} engagement time series:`, error);
      }
    },
    [campaignId, mapEngagementSeries]
  );

  const fetchEngagementsPage = useCallback(
    async (reset: boolean = false) => {
      if (!campaignId) return;
      const nextOffset = reset ? 0 : engagementOffsetRef.current;
      if (reset) {
        setIsLoadingEngagements(true);
        setHasMoreEngagements(true);
        engagementOffsetRef.current = 0;
      } else {
        setIsLoadingMoreEngagements(true);
      }

      try {
        const params = new URLSearchParams({
          limit: String(engagementLimit),
          offset: String(nextOffset),
        });
        if (actionTypeFilter !== 'all') {
          params.set('action_type', actionTypeFilter);
        }

        const response = await fetch(
          `/api/socap/campaigns/${campaignId}/engagements?${params.toString()}`
        );
        const result = await response.json();

        if (result.success) {
          const fetched = result.data?.engagements || [];
          setEngagements((prev) => (reset ? fetched : [...prev, ...fetched]));
          engagementOffsetRef.current = nextOffset + fetched.length;
          setHasMoreEngagements(fetched.length === engagementLimit);
        }
      } catch (error) {
        console.error('Error fetching engagements page:', error);
      } finally {
        if (reset) {
          setIsLoadingEngagements(false);
        } else {
          setIsLoadingMoreEngagements(false);
        }
      }
    },
    [campaignId, engagementLimit, actionTypeFilter]
  );

  const fetchSecondDegree = useCallback(async () => {
    setIsSecondDegreeLoading(true);
    try {
      const response = await fetch(`/api/socap/campaigns/${campaignId}/second-degree`);
      const result = await response.json();
      if (result.success) {
        setSecondDegreeSeries(result.data.series);
        setSecondDegreeTotals(result.data.totals);
      }
    } catch (error) {
      console.error('Error fetching second-degree metrics:', error);
    } finally {
      setIsSecondDegreeLoading(false);
    }
  }, [campaignId]);

  // Track if initial load has happened to avoid double-fetching
  const initialLoadDoneRef = useRef(false);

  // Main data load effect - runs ONLY on mount and campaignId change
  useEffect(() => {
    console.log('[Campaign] Main useEffect triggered, campaignId:', campaignId);
    initialLoadDoneRef.current = false;

    const loadAll = async () => {
      console.log('[Campaign] Starting parallel fetch...');
      setLoading(true);
      await Promise.all([
        fetchDashboard(),
        fetchMetrics(),
        fetchEngagementSeries(),
        fetchCategoryEngagementSeries('main_twt'),
        fetchCategoryEngagementSeries('influencer_twt'),
        fetchSecondDegree(),
      ]);
      console.log('[Campaign] Parallel fetch complete, now fetching engagements...');
      // Fetch engagements separately (depends on actionTypeFilter but we want initial load)
      await fetchEngagementsPage(true);
      setLoading(false);
      initialLoadDoneRef.current = true;
      console.log('[Campaign] Initial load complete');
    };

    loadAll();

    // Auto-refresh every few minutes (3m here) - stable interval
    console.log('[Campaign] Setting up refresh interval');
    const interval = setInterval(() => {
      console.log('[Campaign] Auto-refresh triggered');
      Promise.all([
        fetchDashboard(),
        fetchMetrics(),
        fetchEngagementSeries(),
        fetchCategoryEngagementSeries('main_twt'),
        fetchCategoryEngagementSeries('influencer_twt'),
        fetchSecondDegree(),
      ]);
      // Don't auto-refresh engagements (user controls via Load More)
    }, REFRESH_INTERVAL_MS);

    return () => {
      console.log('[Campaign] Cleaning up interval');
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]); // Only re-run when campaignId changes, not when callbacks change

  // Separate effect for action filter changes (only after initial load)
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      console.log('[Campaign] Skipping filter effect - initial load not done');
      return;
    }
    console.log('[Campaign] Action filter changed to:', actionTypeFilter);
    fetchEngagementsPage(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionTypeFilter]); // Only re-run when filter changes

  // Derive per-category totals for the summary section (runs every render; memoized by dependencies).
  const categoryTotals = useMemo(() => {
    const empty = {
      main_twt: { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0, quote_views: 0 },
      influencer_twt: { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0, quote_views: 0 },
      investor_twt: { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0, quote_views: 0 },
    };

    // Prefer backend-provided totals when available.
    if (data?.category_totals) {
      return data.category_totals;
    }

    if (!data?.tweets || data.tweets.length === 0) {
      return empty;
    }

    const totals = {
      main_twt: { ...empty.main_twt },
      influencer_twt: { ...empty.influencer_twt },
      investor_twt: { ...empty.investor_twt },
    };

    for (const tweet of data.tweets) {
      const target = totals[tweet.category as keyof typeof totals];
      if (!target) continue;

      const metrics = (tweet as any).metrics || {};
      target.likes += metrics.likeCount || 0;
      target.retweets += metrics.retweetCount || 0;
      target.quotes += metrics.quoteCount || 0;
      target.replies += metrics.replyCount || 0;
      target.views += metrics.viewCount || 0;
      target.quote_views += metrics.quoteViewsFromQuotes || 0;
    }

    return totals;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
        <div className="relative z-10 pt-20 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-zinc-400">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
        <div className="relative z-10 pt-20 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-400 text-lg">Campaign not found</p>
            <Link href="/socap" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Back to Campaigns
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pieData = Object.entries(data.category_breakdown).map(([name, value]) => ({
    name,
    value,
  }));

  // Base chart data with all breakdown info
  const baseChartData = metricsData.map((snapshot) => {
    // Ensure tweet_breakdown exists and has proper structure
    const breakdown = snapshot.tweet_breakdown || {
      main_twt: { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0 },
      influencer_twt: { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0 },
      investor_twt: { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0 },
    };
    
    // Helper to safely get category breakdown with defaults
    const getCategoryBreakdown = (category: 'main_twt' | 'influencer_twt' | 'investor_twt') => {
      const catData = breakdown[category];
      if (!catData || typeof catData !== 'object') {
        return { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0 };
      }
      // Handle both number and string (from MongoDB serialization)
      const toNumber = (val: any): number => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };
      return {
        likes: toNumber(catData.likes),
        retweets: toNumber(catData.retweets),
        quotes: toNumber(catData.quotes),
        replies: toNumber(catData.replies),
        views: toNumber(catData.views),
      };
    };
    
    return {
      time: new Date(snapshot.snapshot_time).toLocaleString(),
      timeRaw: new Date(snapshot.snapshot_time), // Keep raw date for sorting/delta calculation
      // Total values (include quote views)
      likes: snapshot.total_likes || 0,
      retweets: snapshot.total_retweets || 0,
      quotes: snapshot.total_quotes || 0,
      replies: snapshot.total_replies || 0,
      views: snapshot.total_views || 0,
      quoteViews: snapshot.total_quote_views || 0,
      // Breakdown values - ensure all categories exist with proper structure
      breakdown: {
        main_twt: getCategoryBreakdown('main_twt'),
        influencer_twt: getCategoryBreakdown('influencer_twt'),
        investor_twt: getCategoryBreakdown('investor_twt'),
      },
    };
  });

  // Helper function to calculate deltas between consecutive data points
  const calculateDeltas = <T extends { [key: string]: any }>(
    data: T[],
    metricKey: string
  ): Array<T & { delta?: number }> => {
    return data.map((item, index) => {
      const currentValue = item[metricKey] || 0;
      const previousValue = index > 0 ? (data[index - 1][metricKey] || 0) : 0;
      const delta = currentValue - previousValue;
      return { ...item, delta };
    });
  };

  // Filtered chart data for each metric using global filter (combined view)
  const getFilteredChartData = (metric: MetricKey) => {
    // For engagement metrics (retweets / replies / quotes), prefer the
    // per-engagement time series based on actual engagement timestamps.
    if (metric === 'retweets' || metric === 'replies' || metric === 'quotes') {
      const data = engagementSeries.map((point) => ({
        time: point.time,
        [metric]: point[metric],
        delta: metric === 'retweets' ? point.retweetsDelta : 
               metric === 'replies' ? point.repliesDelta : 
               point.quotesDelta,
      }));
      return data;
    }

    const data = baseChartData.map((item) => {
      let value: number;

      if (globalFilter === 'all') {
        value = item[metric] || 0;
      } else {
        if (metric === 'quoteViews') {
          value = item.quoteViews || 0;
        } else {
          const categoryData = item.breakdown?.[globalFilter];
          if (categoryData && typeof categoryData === 'object') {
            const metricValue = (categoryData as any)[metric];
            if (typeof metricValue === 'number') {
              value = metricValue;
            } else if (typeof metricValue === 'string') {
              const parsed = parseFloat(metricValue);
              value = isNaN(parsed) ? 0 : parsed;
            } else {
              value = 0;
            }
          } else {
            value = 0;
          }
        }
      }

      return {
        time: item.time,
        timeRaw: item.timeRaw,
        [metric]: value,
      };
    });

    data.sort((a, b) => {
      const timeA = (a as any).timeRaw?.getTime() || new Date(a.time).getTime();
      const timeB = (b as any).timeRaw?.getTime() || new Date(b.time).getTime();
      return timeA - timeB;
    });

    return calculateDeltas(data, metric);
  };

  // Category-scoped chart data (used for main/influencer sections)
  const getCategoryChartData = (metric: MetricKey, category: 'main_twt' | 'influencer_twt') => {
    if (metric === 'retweets' || metric === 'replies' || metric === 'quotes') {
      const source = category === 'main_twt' ? mainEngagementSeries : influencerEngagementSeries;
      return source.map((point) => ({
        time: point.time,
        [metric]: point[metric],
        delta:
          metric === 'retweets'
            ? point.retweetsDelta
            : metric === 'replies'
            ? point.repliesDelta
            : point.quotesDelta,
      }));
    }

    const data = baseChartData.map((item) => {
      if (metric === 'quoteViews') {
        // Not available per category yet
        return { time: item.time, [metric]: 0 };
      }
      const cat = item.breakdown?.[category];
      const valueRaw = (cat as any)?.[metric];
      const value =
        typeof valueRaw === 'number'
          ? valueRaw
          : typeof valueRaw === 'string'
          ? parseFloat(valueRaw) || 0
          : 0;
      return { time: item.time, timeRaw: item.timeRaw, [metric]: value };
    });

    data.sort((a, b) => {
      const timeA = (a as any).timeRaw?.getTime() || new Date(a.time).getTime();
      const timeB = (b as any).timeRaw?.getTime() || new Date(b.time).getTime();
      return timeA - timeB;
    });

    return calculateDeltas(data, metric);
  };

  const getSecondDegreeChartData = (
    category: 'main_twt' | 'influencer_twt',
    metric: keyof SecondDegreePoint
  ) => {
    const series = secondDegreeSeries[category] || [];
    return series.map((p) => ({
      time: new Date(p.time).toLocaleString(),
      [metric]: p[metric] ?? 0,
      delta: p[metric] ?? 0,
    }));
  };

  // Helper function to get tweet info by tweet_id
  const getTweetInfo = (tweetId: string) => {
    return data.tweets?.find(t => t.tweet_id === tweetId);
  };

  // Group engagements by user_id
  interface GroupedEngagement {
    user_id: string;
    account_profile: {
      username: string;
      name: string;
      bio?: string;
      location?: string;
      followers: number;
      verified: boolean;
    };
    importance_score: number;
    account_categories: string[];
    actions: Array<{
      action_type: 'retweet' | 'reply' | 'quote';
      tweet_id: string;
      tweet_category?: 'main_twt' | 'influencer_twt' | 'investor_twt';
      timestamp: Date;
      engagement_tweet_id?: string;
    }>;
  }

  const groupEngagementsByUser = (engagements: any[]): GroupedEngagement[] => {
    const groupedMap = new Map<string, GroupedEngagement>();

    for (const engagement of engagements) {
      const userId = engagement.user_id;

      // Client-side filter (API may also filter)
      if (actionTypeFilter !== 'all' && engagement.action_type !== actionTypeFilter) {
        continue;
      }

      if (!groupedMap.has(userId)) {
        groupedMap.set(userId, {
          user_id: userId,
          account_profile: engagement.account_profile,
          importance_score: engagement.importance_score,
          account_categories: engagement.account_categories || [],
          actions: [],
        });
      }

      const grouped = groupedMap.get(userId)!;
      grouped.actions.push({
        action_type: engagement.action_type,
        tweet_id: engagement.tweet_id,
        tweet_category: engagement.tweet_category,
        timestamp: new Date(engagement.timestamp),
        engagement_tweet_id: engagement.engagement_tweet_id,
      });

      // Keep the highest importance score
      if (engagement.importance_score > grouped.importance_score) {
        grouped.importance_score = engagement.importance_score;
      }
    }

    // Convert to array and sort:
    // 1. First by importance_score (highest first)
    // 2. For accounts with same importance_score (especially 0), sort by followers (highest first)
    return Array.from(groupedMap.values()).sort((a, b) => {
      // Primary sort: importance_score (descending)
      if (b.importance_score !== a.importance_score) {
        return b.importance_score - a.importance_score;
      }
      // Secondary sort: followers (descending) - especially important for zero-importance accounts
      return b.account_profile.followers - a.account_profile.followers;
    });
  };

  const groupedEngagements = groupEngagementsByUser(engagements);

  const filterEngagementsByCategory = (category: 'main_twt' | 'influencer_twt') =>
    groupedEngagements.filter((g) =>
      g.actions.some((a) => a.tweet_category === category)
    );

  // Helper to toggle expanded actions for a person
  const toggleExpandedActions = (userId: string) => {
    setExpandedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          {/* Campaign Header */}
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white mb-2">
                  {data.campaign.launch_name}
                </h1>
                <p className="text-sm text-zinc-400 mt-2">
                  Client: {data.campaign.client_info.name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`px-4 py-2 rounded-full font-semibold text-sm border ${
                  data.campaign.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  data.campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                  'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                }`}>
                  {data.campaign.status}
                </div>
                <button
                  onClick={() => router.push(`/socap/campaigns/${campaignId}/alerts`)}
                  className="px-4 py-2 border border-indigo-400 text-indigo-300 rounded-lg font-medium transition-colors hover:border-indigo-300 hover:text-indigo-200 flex items-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  Alerts
                </button>
              </div>
            </div>
          </div>

          {/* ===== Main Tweet Section ===== */}
          <div className="space-y-6 mb-10">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Main Tweet</h2>
              {data.tweets?.find((t) => t.category === 'main_twt') ? (
                <div className="space-y-4">
                  <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-sm text-zinc-400 mb-2">Embedded tweet</p>
                    <div className="bg-black rounded-lg p-4 border border-zinc-800">
                      <blockquote className="twitter-tweet">
                        <a
                          href={`https://x.com/${data.tweets.find((t) => t.category === 'main_twt')?.author_username}/status/${data.tweets.find((t) => t.category === 'main_twt')?.tweet_id}`}
                          className="text-indigo-400 hover:text-indigo-300 text-sm break-all"
                        >
                          View Main Tweet
                        </a>
                      </blockquote>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="glass rounded-xl p-4 border border-indigo-500/20">
                      <p className="text-sm text-zinc-400">Views</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {(categoryTotals.main_twt?.views ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <p className="text-sm text-zinc-400">Likes</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {(categoryTotals.main_twt?.likes ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <p className="text-sm text-zinc-400">Retweets</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {(categoryTotals.main_twt?.retweets ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <p className="text-sm text-zinc-400">Replies</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {(categoryTotals.main_twt?.replies ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <p className="text-sm text-zinc-400">Quote Tweets</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {(categoryTotals.main_twt?.quotes ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <p className="text-sm text-zinc-400">Quote Views</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {(categoryTotals.main_twt?.quote_views ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {mainEngagementLastUpdated && (
                    <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10">
                      <p className="text-sm text-black">
                        <span className="font-semibold">Note:</span> Engagement charts (Retweets, Replies, Quotes) show data up to{' '}
                        <span className="font-mono">
                          {mainEngagementLastUpdated.toLocaleString()}
                        </span>
                        .
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <MetricChart
                      title="Quote Tweets (Main)"
                      metric="quotes"
                      chartData={getCategoryChartData('quotes', 'main_twt')}
                    />
                    <MetricChart
                      title="Replies (Main)"
                      metric="replies"
                      chartData={getCategoryChartData('replies', 'main_twt')}
                    />
                    <MetricChart
                      title="Retweets (Main)"
                      metric="retweets"
                      chartData={getCategoryChartData('retweets', 'main_twt')}
                    />
                    <MetricChart
                      title="Views (Main)"
                      metric="views"
                      chartData={getCategoryChartData('views', 'main_twt')}
                    />
                    <MetricChart
                      title="Likes (Main)"
                      metric="likes"
                      chartData={getCategoryChartData('likes', 'main_twt')}
                    />
                  </div>

                  <div className="glass rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold text-white">Important People (Main)</h3>
                      <span className="text-xs text-zinc-500">Sorted by importance, then followers</span>
                    </div>
                    <div className="space-y-4">
                      {filterEngagementsByCategory('main_twt').map((person) => {
                        const isExpanded = expandedActions.has(person.user_id);
                        const actionsToShow = isExpanded ? person.actions : person.actions.slice(0, 3);
                        const hasMoreActions = person.actions.length > 3;
                        const firstAction = person.actions[0];
                        if (firstAction?.tweet_category !== 'main_twt') {
                          // Skip if this person has no main tweet actions (safety)
                        }
                        return (
                          <div
                            key={person.user_id}
                            className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-semibold text-zinc-900">
                                      {person.account_profile.name}
                                    </span>
                                    {person.account_profile.verified && (
                                      <svg
                                        className="w-4 h-4 text-indigo-500"
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
                                </div>
                                <div className="text-sm text-zinc-600 mb-1">@{person.account_profile.username}</div>
                                {person.account_profile.bio && (
                                  <div className="text-xs text-zinc-600 mb-2 line-clamp-2">
                                    {person.account_profile.bio}
                                  </div>
                                )}
                                <div className="text-xs text-zinc-500">
                                  {person.account_profile.followers.toLocaleString()} followers
                                </div>
                              </div>

                              <div className="md:w-2/5 flex flex-col gap-3 border-t border-zinc-200 pt-3 md:border-t-0 md:border-l md:pl-4">
                                <div className="flex items-center justify-between md:justify-end">
                                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                    Imp. Score - 
                                  </span>
                                  <span className="text-lg font-bold text-emerald-600">
                                    {person.importance_score.toFixed(1)}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-medium text-zinc-700">
                                      Actions
                                    </div>
                                    {hasMoreActions && (
                                      <button
                                        onClick={() => toggleExpandedActions(person.user_id)}
                                        className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
                                      >
                                        {isExpanded ? 'Show Less' : 'Show All'}
                                      </button>
                                    )}
                                  </div>
                                  <div className={`space-y-0.5 ${isExpanded && hasMoreActions ? 'max-h-96 overflow-y-auto pr-2' : ''}`}>
                                    {actionsToShow.map((action, idx) => {
                                      if (action.tweet_category !== 'main_twt') return null;
                                      const tweetInfo = getTweetInfo(action.tweet_id);
                                      const hasEngagementTweet =
                                        (action.action_type === 'quote' || action.action_type === 'reply') &&
                                        !!action.engagement_tweet_id;
                                      
                                      const baseUsername = hasEngagementTweet
                                        ? person.account_profile.username
                                        : tweetInfo?.author_username;
                                      
                                      const targetTweetId = hasEngagementTweet
                                        ? action.engagement_tweet_id!
                                        : action.tweet_id;
                                      
                                      const tweetIdShort = targetTweetId.slice(-8);
                                      
                                      const tweetUrl = baseUsername
                                        ? `https://x.com/${baseUsername}/status/${targetTweetId}`
                                        : `https://x.com/i/web/status/${targetTweetId}`;
                                      
                                      return (
                                        <div key={idx} className="ml-2 text-xs text-zinc-700">
                                          <div className="flex items-center gap-1">
                                            <span className="text-zinc-500">• </span>
                                            <span className="text-zinc-600">
                                              {action.action_type === 'reply' && (hasEngagementTweet ? 'Replied ' : 'Replied to ')}
                                              {action.action_type === 'retweet' && 'Retweeted '}
                                              {action.action_type === 'quote' && (hasEngagementTweet ? 'Quoted ' : 'Quoted tweet ')}
                                            </span>
                                            <a
                                              href={tweetUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-indigo-600 hover:text-indigo-700 hover:underline"
                                            >
                                              Tweet {tweetIdShort}
                                            </a>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {filterEngagementsByCategory('main_twt').length === 0 && (
                        <div className="text-center text-zinc-500">No engagements on main tweet yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="glass rounded-2xl p-6 border border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Second-Degree Engagements (Main)</h3>
                      <span className="text-xs text-zinc-500">From quote tweets & second-order</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                      <div className="glass rounded-xl p-3 border border-indigo-500/20">
                        <p className="text-xs text-zinc-400">Quote Views</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {(secondDegreeTotals.main_twt.views || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="glass rounded-xl p-3">
                        <p className="text-xs text-zinc-400">Quote Likes</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {(secondDegreeTotals.main_twt.likes || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="glass rounded-xl p-3">
                        <p className="text-xs text-zinc-400">Quote Retweets</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {(secondDegreeTotals.main_twt.retweets || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="glass rounded-xl p-3">
                        <p className="text-xs text-zinc-400">Quote Replies</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {(secondDegreeTotals.main_twt.replies || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="glass rounded-xl p-3">
                        <p className="text-xs text-zinc-400">2nd Retweets</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {(secondDegreeTotals.main_twt.second_order_retweets || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="glass rounded-xl p-3">
                        <p className="text-xs text-zinc-400">2nd Replies</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {(secondDegreeTotals.main_twt.second_order_replies || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      <MetricChart
                        title="Quote Views (Main)"
                        metric="views"
                        chartData={getSecondDegreeChartData('main_twt', 'views')}
                      />
                      <MetricChart
                        title="Quote Likes (Main)"
                        metric="likes"
                        chartData={getSecondDegreeChartData('main_twt', 'likes')}
                      />
                      <MetricChart
                        title="Quote Retweets (Main)"
                        metric="retweets"
                        chartData={getSecondDegreeChartData('main_twt', 'retweets')}
                      />
                      <MetricChart
                        title="Quote Replies (Main)"
                        metric="replies"
                        chartData={getSecondDegreeChartData('main_twt', 'replies')}
                      />
                      <MetricChart
                        title="2nd Order Retweets (Main)"
                        metric="second_order_retweets"
                        chartData={getSecondDegreeChartData('main_twt', 'second_order_retweets')}
                      />
                      <MetricChart
                        title="2nd Order Replies (Main)"
                        metric="second_order_replies"
                        chartData={getSecondDegreeChartData('main_twt', 'second_order_replies')}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-400 text-sm">No main tweet found for this campaign.</div>
              )}
            </div>
          </div>

          {/* ===== Influencer Tweets Section ===== */}
          <div className="space-y-6 mb-10">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Influencer Tweets</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                <div className="glass rounded-xl p-4 border border-indigo-500/20">
                  <p className="text-sm text-zinc-400">Views</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {(categoryTotals.influencer_twt?.views ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-zinc-400">Likes</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {(categoryTotals.influencer_twt?.likes ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-zinc-400">Retweets</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {(categoryTotals.influencer_twt?.retweets ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-zinc-400">Replies</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {(categoryTotals.influencer_twt?.replies ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-zinc-400">Quote Tweets</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {(categoryTotals.influencer_twt?.quotes ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-zinc-400">Quote Views</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {(categoryTotals.influencer_twt?.quote_views ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {influencerEngagementLastUpdated && (
                <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10 mb-4">
                  <p className="text-sm text-black">
                    <span className="font-semibold">Note:</span> Engagement charts (Retweets, Replies, Quotes) show data up to{' '}
                    <span className="font-mono">
                      {influencerEngagementLastUpdated.toLocaleString()}
                    </span>
                    .
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <MetricChart
                  title="Quote Tweets (Influencer)"
                  metric="quotes"
                  chartData={getCategoryChartData('quotes', 'influencer_twt')}
                />
                <MetricChart
                  title="Replies (Influencer)"
                  metric="replies"
                  chartData={getCategoryChartData('replies', 'influencer_twt')}
                />
                <MetricChart
                  title="Retweets (Influencer)"
                  metric="retweets"
                  chartData={getCategoryChartData('retweets', 'influencer_twt')}
                />
                <MetricChart
                  title="Views (Influencer)"
                  metric="views"
                  chartData={getCategoryChartData('views', 'influencer_twt')}
                />
                <MetricChart
                  title="Likes (Influencer)"
                  metric="likes"
                  chartData={getCategoryChartData('likes', 'influencer_twt')}
                />
              </div>

              <div className="glass rounded-2xl p-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">Important People (Influencer)</h3>
                  <span className="text-xs text-zinc-500">Sorted by importance, then followers</span>
                </div>
                <div className="space-y-4">
                  {filterEngagementsByCategory('influencer_twt').map((person) => {
                    const isExpanded = expandedActions.has(person.user_id);
                    const actionsToShow = isExpanded ? person.actions : person.actions.slice(0, 3);
                    const hasMoreActions = person.actions.length > 3;
                    return (
                      <div
                        key={person.user_id}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-semibold text-zinc-900">
                                  {person.account_profile.name}
                                </span>
                                {person.account_profile.verified && (
                                  <svg
                                    className="w-4 h-4 text-indigo-500"
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
                            </div>
                            <div className="text-sm text-zinc-600 mb-1">@{person.account_profile.username}</div>
                            {person.account_profile.bio && (
                              <div className="text-xs text-zinc-600 mb-2 line-clamp-2">
                                {person.account_profile.bio}
                              </div>
                            )}
                            <div className="text-xs text-zinc-500">
                              {person.account_profile.followers.toLocaleString()} followers
                            </div>
                          </div>

                          <div className="md:w-2/5 flex flex-col gap-3 border-t border-zinc-200 pt-3 md:border-t-0 md:border-l md:pl-4">
                            <div className="flex items-center justify-between md:justify-end">
                              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                Imp. Score - 
                              </span>
                              <span className="text-lg font-bold text-emerald-600">
                                {person.importance_score.toFixed(1)}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-medium text-zinc-700">
                                  Actions
                                </div>
                                {hasMoreActions && (
                                  <button
                                    onClick={() => toggleExpandedActions(person.user_id)}
                                    className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
                                  >
                                    {isExpanded ? 'Show Less' : 'Show All'}
                                  </button>
                                )}
                              </div>
                              <div className={`space-y-0.5 ${isExpanded && hasMoreActions ? 'max-h-96 overflow-y-auto pr-2' : ''}`}>
                                {actionsToShow.map((action, idx) => {
                                  if (action.tweet_category !== 'influencer_twt') return null;
                                  const tweetInfo = getTweetInfo(action.tweet_id);
                                  const hasEngagementTweet =
                                    (action.action_type === 'quote' || action.action_type === 'reply') &&
                                    !!action.engagement_tweet_id;
                                  
                                  const baseUsername = hasEngagementTweet
                                    ? person.account_profile.username
                                    : tweetInfo?.author_username;
                                  
                                  const targetTweetId = hasEngagementTweet
                                    ? action.engagement_tweet_id!
                                    : action.tweet_id;
                                  
                                  const tweetIdShort = targetTweetId.slice(-8);
                                  
                                  const tweetUrl = baseUsername
                                    ? `https://x.com/${baseUsername}/status/${targetTweetId}`
                                    : `https://x.com/i/web/status/${targetTweetId}`;
                                  
                                  return (
                                    <div key={idx} className="ml-2 text-xs text-zinc-700">
                                      <div className="flex items-center gap-1">
                                        <span className="text-zinc-500">• </span>
                                        <span className="text-zinc-600">
                                          {action.action_type === 'reply' && (hasEngagementTweet ? 'Replied ' : 'Replied to ')}
                                          {action.action_type === 'retweet' && 'Retweeted '}
                                          {action.action_type === 'quote' && (hasEngagementTweet ? 'Quoted ' : 'Quoted tweet ')}
                                        </span>
                                        <a
                                          href={tweetUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-600 hover:text-indigo-700 hover:underline"
                                        >
                                          Tweet {tweetIdShort}
                                        </a>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filterEngagementsByCategory('influencer_twt').length === 0 && (
                    <div className="text-center text-zinc-500">No engagements on influencer tweets yet.</div>
                  )}
                </div>
              </div>

              <div className="glass rounded-2xl p-6 border border-zinc-800 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Second-Degree Engagements (Influencer)</h3>
                  <span className="text-xs text-zinc-500">From quote tweets & second-order</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                  <div className="glass rounded-xl p-3 border border-indigo-500/20">
                    <p className="text-xs text-zinc-400">Quote Views</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {(secondDegreeTotals.influencer_twt.views || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-xs text-zinc-400">Quote Likes</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {(secondDegreeTotals.influencer_twt.likes || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-xs text-zinc-400">Quote Retweets</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {(secondDegreeTotals.influencer_twt.retweets || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-xs text-zinc-400">Quote Replies</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {(secondDegreeTotals.influencer_twt.replies || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-xs text-zinc-400">2nd Retweets</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {(secondDegreeTotals.influencer_twt.second_order_retweets || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-xs text-zinc-400">2nd Replies</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {(secondDegreeTotals.influencer_twt.second_order_replies || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <MetricChart
                    title="Quote Views (Influencer)"
                    metric="views"
                    chartData={getSecondDegreeChartData('influencer_twt', 'views')}
                  />
                  <MetricChart
                    title="Quote Likes (Influencer)"
                    metric="likes"
                    chartData={getSecondDegreeChartData('influencer_twt', 'likes')}
                  />
                  <MetricChart
                    title="Quote Retweets (Influencer)"
                    metric="retweets"
                    chartData={getSecondDegreeChartData('influencer_twt', 'retweets')}
                  />
                  <MetricChart
                    title="Quote Replies (Influencer)"
                    metric="replies"
                    chartData={getSecondDegreeChartData('influencer_twt', 'replies')}
                  />
                  <MetricChart
                    title="2nd Order Retweets (Influencer)"
                    metric="second_order_retweets"
                    chartData={getSecondDegreeChartData('influencer_twt', 'second_order_retweets')}
                  />
                  <MetricChart
                    title="2nd Order Replies (Influencer)"
                    metric="second_order_replies"
                    chartData={getSecondDegreeChartData('influencer_twt', 'second_order_replies')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ===== Combined Metrics (kept) ===== */}
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Combined Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Total Likes</p>
                <p className="text-2xl font-bold text-white mt-1">{data.metrics.total_likes.toLocaleString()}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Total Retweets</p>
                <p className="text-2xl font-bold text-white mt-1">{data.metrics.total_retweets.toLocaleString()}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Total Replies</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {data.metrics.total_replies.toLocaleString()}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Total Quote Tweets</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {data.metrics.total_quotes.toLocaleString()}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Total Views</p>
                <p className="text-2xl font-bold text-white mt-1">{data.metrics.total_views.toLocaleString()}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Total Views from Quote Twt</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {(data.metrics.total_quote_views ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Total Engagements</p>
                <p className="text-2xl font-bold text-white mt-1">{data.metrics.total_engagements.toLocaleString()}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-sm text-zinc-400">Unique Engagers</p>
                <p className="text-2xl font-bold text-white mt-1">{data.metrics.unique_engagers.toLocaleString()}</p>
              </div>
            </div>

            {/* Per-Category Metrics */}
            <div className="glass rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Metrics by Tweet Type</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(
                  [
                    { key: 'main_twt', label: 'Main Tweet' },
                    { key: 'influencer_twt', label: 'Influencer Tweet' },
                    { key: 'investor_twt', label: 'Investor Tweet' },
                  ] as const
                ).map(({ key, label }) => {
                  const totals = categoryTotals[key];
                  const hasTweets = (data.tweets || []).some((t) => t.category === key);
                  return (
                    <div key={key} className="glass rounded-xl p-4 border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-zinc-300 font-semibold">{label}</p>
                        {!hasTweets && (
                          <span className="text-xs text-zinc-500">No tweets yet</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-zinc-400">
                        <div>Likes</div>
                        <div className="text-right text-white font-semibold">{(totals?.likes || 0).toLocaleString()}</div>
                        <div>Retweets</div>
                        <div className="text-right text-white font-semibold">{(totals?.retweets || 0).toLocaleString()}</div>
                        <div>Replies</div>
                        <div className="text-right text-white font-semibold">{(totals?.replies || 0).toLocaleString()}</div>
                        <div>Quote Tweets</div>
                        <div className="text-right text-white font-semibold">{(totals?.quotes || 0).toLocaleString()}</div>
                        <div>Views</div>
                        <div className="text-right text-white font-semibold">{(totals?.views || 0).toLocaleString()}</div>
                        <div>Quote Views</div>
                        <div className="text-right text-white font-semibold">
                          {(totals?.quote_views || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Global Filter Toggle for combined charts */}
            <div className="glass rounded-2xl p-6 mb-6">
              <div className="flex justify-end items-center">
                <div className="flex items-center gap-3">
                  <label htmlFor="metric-filter" className="text-sm font-medium text-zinc-300">
                    Filter Metrics By:
                  </label>
                  <select
                    id="metric-filter"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value as FilterType)}
                    className="px-4 py-2 text-sm border border-zinc-700 rounded-lg bg-zinc-900 text-white hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer min-w-[200px] transition-all"
                  >
                    <option value="all">All (Combined)</option>
                    <option value="main_twt">Main Tweet</option>
                    <option value="influencer_twt">Influencer Tweets</option>
                    <option value="investor_twt">Investor Tweets</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
              {engagementLastUpdated && (
                <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10 col-span-full">
                  <p className="text-sm text-black">
                    <span className="font-semibold">Note:</span> Engagement charts (Retweets, Replies, Quotes) show data up to{' '}
                    <span className="font-mono">
                      {engagementLastUpdated.toLocaleString()}
                    </span>
                    .
                  </p>
                </div>
              )}

              <MetricChart
                title="Quote Tweets (Combined)"
                metric="quotes"
                chartData={getFilteredChartData('quotes')}
              />
              <MetricChart
                title="Replies (Combined)"
                metric="replies"
                chartData={getFilteredChartData('replies')}
              />
              <MetricChart
                title="Retweets (Combined)"
                metric="retweets"
                chartData={getFilteredChartData('retweets')}
              />
              <MetricChart
                title="Total Views (Combined)"
                metric="views"
                chartData={getFilteredChartData('views')}
              />
              <MetricChart
                title="Likes (Combined)"
                metric="likes"
                chartData={getFilteredChartData('likes')}
              />

              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Account Categories</h2>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#f3f4f6' }}
                        itemStyle={{ color: '#f3f4f6' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-zinc-400 py-12">
                    No category data yet
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

