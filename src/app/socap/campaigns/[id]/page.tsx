'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Trash2, Pause, Bell } from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
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
    total_engagements: number;
    unique_engagers: number;
  };
  latest_engagements: any[];
  category_breakdown: Record<string, number>;
  tweets?: Array<{
    tweet_id: string;
    category: 'main_twt' | 'influencer_twt' | 'investor_twt';
    author_username: string;
  }>;
}

const COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#3b82f6', '#f472b6', '#fbbf24', '#fb923c', '#94a3b8'];

type FilterType = 'all' | 'main_twt' | 'influencer_twt' | 'investor_twt';

type MetricKey = 'likes' | 'retweets' | 'quotes' | 'replies' | 'views' | 'quoteViews';

interface MetricChartProps {
  title: string;
  metric: MetricKey;
  chartData: Array<{ time: string; [key: string]: any }>;
  color: string;
}

function MetricChart({ title, metric, chartData, color }: Omit<MetricChartProps, 'filter' | 'onFilterChange'>) {
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
          <p style={{ color: color, marginBottom: '4px' }}>
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

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <XAxis dataKey="time" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey={metric}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Single global filter state for all charts
  const [globalFilter, setGlobalFilter] = useState<'all' | 'main_twt' | 'influencer_twt' | 'investor_twt'>('all');

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
    }
  }, [campaignId]);

  const fetchEngagementSeries = useCallback(async () => {
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

        // Sort points by time to ensure proper cumulative calculation
        const sortedPoints = [...points].sort((a, b) => {
          const timeA = new Date(a.time).getTime();
          const timeB = new Date(b.time).getTime();
          return timeA - timeB;
        });

        // Convert per-bucket counts to cumulative totals
        let cumulativeRetweets = 0;
        let cumulativeReplies = 0;
        let cumulativeQuotes = 0;
        let cumulativeTotal = 0;

        const mapped = sortedPoints.map((p) => {
          // Add current bucket's counts to cumulative totals
          cumulativeRetweets += p.retweets ?? 0;
          cumulativeReplies += p.replies ?? 0;
          cumulativeQuotes += p.quotes ?? 0;
          cumulativeTotal += p.total ?? 0;

          return {
            time: new Date(p.time).toLocaleString(),
            timeRaw: new Date(p.time), // Keep raw date for sorting/delta calculation
            retweets: cumulativeRetweets,
            replies: cumulativeReplies,
            quotes: cumulativeQuotes,
            total: cumulativeTotal,
            // Store deltas (per-bucket counts) for tooltip display
            retweetsDelta: p.retweets ?? 0,
            repliesDelta: p.replies ?? 0,
            quotesDelta: p.quotes ?? 0,
            totalDelta: p.total ?? 0,
          };
        });

        setEngagementSeries(mapped);
        
        // Store last updated timestamp if available
        if (result.data?.last_updated) {
          setEngagementLastUpdated(new Date(result.data.last_updated));
        } else {
          setEngagementLastUpdated(null);
        }
      }
    } catch (error) {
      console.error('Error fetching engagement time series:', error);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchDashboard();
    fetchMetrics();
    fetchEngagementSeries();
    
    // Auto-refresh every minute
    const interval = setInterval(() => {
      fetchDashboard();
      fetchMetrics();
      fetchEngagementSeries();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [campaignId, fetchDashboard, fetchMetrics, fetchEngagementSeries]);

  async function updateCampaignStatus(newStatus: 'active' | 'paused') {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/socap/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchDashboard(); // Refresh data
        setShowPauseConfirm(false);
        alert(`Campaign ${newStatus === 'paused' ? 'paused' : 'resumed'} successfully`);
      } else {
        alert(`Failed to update: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update campaign status');
    } finally {
      setActionLoading(false);
    }
  }


  async function deleteCampaign() {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/socap/campaigns/${campaignId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Campaign deleted successfully');
        window.location.href = '/socap'; // Redirect to campaigns list
      } else {
        alert(`Failed to delete: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Failed to delete campaign');
    } finally {
      setActionLoading(false);
      setShowDeleteConfirm(false);
    }
  }

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

  // Filtered chart data for each metric using global filter
  const getFilteredChartData = (metric: MetricKey) => {
    // For engagement metrics (retweets / replies / quotes), prefer the
    // per-engagement time series based on actual engagement timestamps.
    if (metric === 'retweets' || metric === 'replies' || metric === 'quotes') {
      const data = engagementSeries.map((point) => ({
        time: point.time,
        [metric]: point[metric],
        // Include delta from the engagement series (already calculated per-bucket)
        delta: metric === 'retweets' ? point.retweetsDelta : 
               metric === 'replies' ? point.repliesDelta : 
               point.quotesDelta,
      }));
      return data;
    }

    const data = baseChartData.map((item) => {
      let value: number;
      if (globalFilter === 'all') {
        // For total views in "All (Combined)" view, include both base tweet views and quote tweet views
        if (metric === 'views') {
          const baseViews = item.views || 0;
          const quoteViews = item.quoteViews || 0;
          value = baseViews + quoteViews;
        } else {
          value = item[metric] || 0;
        }
      } else {
        // For quoteViews we don't yet have per-category breakdown, so fall back to total
        if (metric === 'quoteViews') {
          value = item.quoteViews || 0;
        } else {
          // Access breakdown data - ensure we're getting the right property
          const categoryData = item.breakdown?.[globalFilter];
          if (categoryData && typeof categoryData === 'object') {
            // Safely access the metric value, handling both number and string types
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
        timeRaw: item.timeRaw, // Keep for sorting
        [metric]: value,
      };
    });

    // Sort by time to ensure proper delta calculation
    data.sort((a, b) => {
      const timeA = (a as any).timeRaw?.getTime() || new Date(a.time).getTime();
      const timeB = (b as any).timeRaw?.getTime() || new Date(b.time).getTime();
      return timeA - timeB;
    });

    // Calculate deltas for view metrics
    return calculateDeltas(data, metric);
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      
      <div className="relative z-10">
        {/* Header Section */}
        <div className="pt-24 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link href="/socap" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm mb-6 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Campaigns
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
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
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/socap/campaigns/${campaignId}/alerts`)}
                    className="px-4 py-2 border border-indigo-400 text-indigo-300 rounded-lg font-medium transition-colors hover:border-indigo-300 hover:text-indigo-200 flex items-center gap-2"
                  >
                    <Bell className="w-4 h-4" />
                    Alerts
                  </button>
                  {data.campaign.status === 'active' ? (
                    <button
                      onClick={() => setShowPauseConfirm(true)}
                      disabled={actionLoading}
                      className="p-2 border border-yellow-400 text-yellow-300 rounded-lg transition-colors disabled:border-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed hover:border-yellow-300 hover:text-yellow-200 flex items-center justify-center"
                      title="Pause Campaign"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : data.campaign.status === 'paused' ? (
                    <button
                      onClick={() => updateCampaignStatus('active')}
                      disabled={actionLoading}
                      className="px-4 py-2 border border-emerald-400 text-emerald-300 rounded-lg font-medium transition-colors disabled:border-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed hover:border-emerald-300 hover:text-emerald-200"
                    >
                      {actionLoading ? 'Resuming...' : 'Resume'}
                    </button>
                  ) : null}
                  <button
                    onClick={() => router.push(`/socap/campaigns/${campaignId}/edit`)}
                    className="px-4 py-2 border border-indigo-400 text-indigo-300 rounded-lg font-medium transition-colors hover:border-indigo-300 hover:text-indigo-200"
                  >
                    Edit Campaign
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={actionLoading}
                    className="p-2 border border-red-500 text-red-400 rounded-lg transition-colors disabled:border-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed hover:border-red-400 hover:text-red-300 flex items-center justify-center"
                    title="Delete Campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Cards */}
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
              <p className="text-sm text-zinc-400">Total Views from QuoteTwt</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">
                {((data.metrics as any).total_quote_views ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-zinc-400">Total Views (All)</p>
              <p className="text-2xl font-bold text-white mt-1">
                {(
                  (data.metrics.total_views ?? 0) +
                  (((data.metrics as any).total_quote_views ?? 0) as number)
                ).toLocaleString()}
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

          {/* Global Filter Toggle */}
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

          {/* Charts */}
          <div className="space-y-6 mb-6">
          {/* Engagement Data Status Note */}
          {engagementLastUpdated && (
            <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10">
              <p className="text-sm text-black">
                <span className="font-semibold">Note:</span> Engagement charts (Retweets, Replies, Quotes) show data up to{' '}
                <span className="font-mono">
                  {engagementLastUpdated.toLocaleString()}
                </span>
                . New engagements will appear once workers process them. For campaigns where metrics are collected
                retrospectively, the charts for views, views from quote tweets, likes, and retweets may not be fully accurate
                because we don&apos;t have a reliable timestamp for when those actions occurred.
              </p>
            </div>
          )}
          
        {/* Quote Tweets Chart (Top Priority) */}
        <MetricChart
          title="Quote Tweets"
          metric="quotes"
          chartData={getFilteredChartData('quotes')}
          color="#fbbf24"
        />

        {/* Reply Count Chart (Top Priority) */}
        <MetricChart
          title="Replies"
          metric="replies"
          chartData={getFilteredChartData('replies')}
          color="#fb923c"
        />

        {/* Retweet Count Chart */}
        <MetricChart
          title="Retweets"
          metric="retweets"
          chartData={getFilteredChartData('retweets')}
          color="#34d399"
        />

        {/* Quote Views Chart */}
        <MetricChart
          title="Views from Quote Tweets"
          metric="quoteViews"
          chartData={getFilteredChartData('quoteViews')}
          color="#f472b6"
        />

        {/* View Count Chart */}
        <MetricChart
          title="Total Views"
          metric="views"
          chartData={getFilteredChartData('views')}
          color="#a78bfa"
        />

        {/* Like Count Chart */}
        <MetricChart
          title="Likes"
          metric="likes"
          chartData={getFilteredChartData('likes')}
          color="#6366f1"
        />

        {/* Category Breakdown */}
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

          {/* Latest Engagements */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-semibold text-white">Latest Engagements</h2>
            </div>
            {data.latest_engagements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Account</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Importance</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Categories</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.latest_engagements.map((engagement, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-white">
                            @{engagement.account_profile.username}
                          </div>
                          <div className="text-sm text-zinc-400">
                            {engagement.account_profile.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-white capitalize">{engagement.action_type}</td>
                        <td className="px-6 py-4">
                          <span className="text-lg font-bold text-emerald-400">
                            {engagement.importance_score}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-300">
                          {engagement.account_categories?.join(', ') || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-400">
                          {new Date(engagement.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-zinc-400 py-12">
                No engagements yet
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="glass rounded-2xl p-6 max-w-md w-full mx-4 border border-zinc-800">
                <h2 className="text-2xl font-bold mb-4 text-red-400">Delete Campaign</h2>
                <p className="mb-4 text-zinc-300">
                  Are you sure you want to delete &quot;{data?.campaign.launch_name}&quot;? This action cannot be undone.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 border border-zinc-600 rounded-lg text-zinc-200 hover:border-zinc-400 hover:text-zinc-100 transition-colors"
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteCampaign}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-red-500 text-red-400 rounded-lg hover:border-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading ? 'Deleting...' : 'Delete Campaign'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pause Confirmation Modal */}
          {showPauseConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="glass rounded-2xl p-6 max-w-md w-full mx-4 border border-zinc-800">
                <h2 className="text-2xl font-bold mb-4 text-yellow-400">Pause Campaign</h2>
                <p className="mb-4 text-zinc-300">
                  Are you sure you want to pause &quot;{data?.campaign.launch_name}&quot;? The campaign will stop processing new engagements.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowPauseConfirm(false)}
                    className="px-4 py-2 border border-zinc-600 rounded-lg text-zinc-200 hover:border-zinc-400 hover:text-zinc-100 transition-colors"
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateCampaignStatus('paused')}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-yellow-500 text-yellow-400 rounded-lg hover:border-yellow-400 hover:text-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading ? 'Pausing...' : 'Pause Campaign'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

