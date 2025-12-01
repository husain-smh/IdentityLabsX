'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

type FilterType = 'all' | 'main_twt' | 'influencer_twt' | 'investor_twt';

type MetricKey = 'likes' | 'retweets' | 'quotes' | 'replies' | 'views' | 'quoteViews';

interface MetricChartProps {
  title: string;
  metric: MetricKey;
  chartData: Array<{ time: string; [key: string]: any }>;
  color: string;
}

function MetricChart({ title, metric, chartData, color }: Omit<MetricChartProps, 'filter' | 'onFilterChange'>) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={metric}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center text-gray-500 py-12">
          No metrics data yet
        </div>
      )}
    </div>
  );
}

export default function CampaignDashboardPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsData, setMetricsData] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  useEffect(() => {
    fetchDashboard();
    fetchMetrics();
    
    // Auto-refresh every minute
    const interval = setInterval(() => {
      fetchDashboard();
      fetchMetrics();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [campaignId, fetchDashboard, fetchMetrics]);

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

  async function updateCampaignSettings(formData: {
    importance_threshold: number;
    alert_spacing_minutes: number;
    frequency_window_minutes: number;
    channels: string[];
  }) {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/socap/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_preferences: formData,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchDashboard(); // Refresh data
        setShowEditModal(false);
        alert('Campaign settings updated successfully');
      } else {
        alert(`Failed to update: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update campaign settings');
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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Campaign not found</div>
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

  // Filtered chart data for each metric using global filter
  const getFilteredChartData = (metric: MetricKey) => {
    return baseChartData.map((item) => {
      let value: number;
      if (globalFilter === 'all') {
        value = item[metric] || 0;
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
        [metric]: value,
      };
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/socap" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Campaigns
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{data.campaign.launch_name}</h1>
            <p className="text-gray-600 mt-2">
              Client: {data.campaign.client_info.name} | Status:{' '}
              <span className={`font-semibold ${
                data.campaign.status === 'active' ? 'text-green-600' :
                data.campaign.status === 'paused' ? 'text-yellow-600' :
                'text-gray-600'
              }`}>
                {data.campaign.status}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            {data.campaign.status === 'active' ? (
              <button
                onClick={() => updateCampaignStatus('paused')}
                disabled={actionLoading}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                {actionLoading ? 'Pausing...' : 'Pause Campaign'}
              </button>
            ) : data.campaign.status === 'paused' ? (
              <button
                onClick={() => updateCampaignStatus('active')}
                disabled={actionLoading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'Resuming...' : 'Resume Campaign'}
              </button>
            ) : null}
            <button
              onClick={() => setShowEditModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Edit Settings
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={actionLoading}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Likes</div>
          <div className="text-2xl font-bold">{data.metrics.total_likes.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Retweets</div>
          <div className="text-2xl font-bold">{data.metrics.total_retweets.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Views</div>
          <div className="text-2xl font-bold">{data.metrics.total_views.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Quote Views</div>
          <div className="text-2xl font-bold">
            {((data.metrics as any).total_quote_views ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Views (All)</div>
          <div className="text-2xl font-bold">
            {(
              (data.metrics.total_views ?? 0) +
              (((data.metrics as any).total_quote_views ?? 0) as number)
            ).toLocaleString()}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Engagements</div>
          <div className="text-2xl font-bold">{data.metrics.total_engagements.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Unique Engagers</div>
          <div className="text-2xl font-bold">{data.metrics.unique_engagers.toLocaleString()}</div>
        </div>
      </div>

      {/* Global Filter Toggle */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex justify-end items-center">
          <div className="flex items-center gap-3">
            <label htmlFor="metric-filter" className="text-sm font-medium text-gray-700">
              Filter Metrics By:
            </label>
            <select
              id="metric-filter"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value as FilterType)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer min-w-[200px]"
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
      <div className="space-y-6 mb-8">
        {/* Quote Count Chart */}
        <MetricChart
          title="Quote Count vs Time"
          metric="quotes"
          chartData={getFilteredChartData('quotes')}
          color="#ffc658"
        />

        {/* Quote Views Chart */}
        <MetricChart
          title="Quote Views vs Time"
          metric="quoteViews"
          chartData={getFilteredChartData('quoteViews')}
          color="#d81b60"
        />

        {/* View Count Chart */}
        <MetricChart
          title="View Count vs Time"
          metric="views"
          chartData={getFilteredChartData('views')}
          color="#9c27b0"
        />

        {/* Retweet Count Chart */}
        <MetricChart
          title="Retweet Count vs Time"
          metric="retweets"
          chartData={getFilteredChartData('retweets')}
          color="#82ca9d"
        />

        {/* Reply Count Chart */}
        <MetricChart
          title="Reply Count vs Time"
          metric="replies"
          chartData={getFilteredChartData('replies')}
          color="#ff7300"
        />

        {/* Like Count Chart */}
        <MetricChart
          title="Like Count vs Time"
          metric="likes"
          chartData={getFilteredChartData('likes')}
          color="#8884d8"
        />

        {/* Category Breakdown */}
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Account Categories</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb', // tailwind gray-200
                    borderRadius: 6,
                    color: '#111827', // tailwind gray-900
                  }}
                  labelStyle={{ color: '#6b7280' }} // tailwind gray-500
                  itemStyle={{ color: '#111827' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-12">
              No category data yet
            </div>
          )}
        </div>
      </div>

      {/* Latest Engagements */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Latest Engagements</h2>
        {data.latest_engagements.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Account</th>
                  <th className="text-left p-2">Action</th>
                  <th className="text-left p-2">Importance</th>
                  <th className="text-left p-2">Categories</th>
                  <th className="text-left p-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.latest_engagements.map((engagement, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">
                      <div className="font-semibold">
                        @{engagement.account_profile.username}
                      </div>
                      <div className="text-sm text-gray-600">
                        {engagement.account_profile.name}
                      </div>
                    </td>
                    <td className="p-2 capitalize">{engagement.action_type}</td>
                    <td className="p-2 font-semibold">{engagement.importance_score}</td>
                    <td className="p-2">
                      {engagement.account_categories?.join(', ') || 'N/A'}
                    </td>
                    <td className="p-2 text-sm text-gray-600">
                      {new Date(engagement.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            No engagements yet
          </div>
        )}
      </div>

      {/* Edit Settings Modal */}
      {showEditModal && data && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Edit Campaign Settings</h2>
            <EditSettingsForm
              campaign={data.campaign}
              onSave={updateCampaignSettings}
              onCancel={() => setShowEditModal(false)}
              loading={actionLoading}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Campaign</h2>
            <p className="mb-4">
              Are you sure you want to delete &quot;{data?.campaign.launch_name}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={deleteCampaign}
                disabled={actionLoading}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditSettingsForm({ 
  campaign, 
  onSave, 
  onCancel, 
  loading 
}: { 
  campaign: any; 
  onSave: (data: any) => void; 
  onCancel: () => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState({
    importance_threshold: campaign.alert_preferences.importance_threshold || 10,
    alert_spacing_minutes: campaign.alert_preferences.alert_spacing_minutes || 20,
    frequency_window_minutes: campaign.alert_preferences.frequency_window_minutes || 30,
    channels: campaign.alert_preferences.channels || ['email'],
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  function toggleChannel(channel: string) {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c: string) => c !== channel)
        : [...prev.channels, channel],
    }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Importance Threshold
        </label>
        <input
          type="number"
          min="1"
          value={formData.importance_threshold}
          onChange={(e) => setFormData(prev => ({ ...prev, importance_threshold: parseInt(e.target.value) }))}
          className="w-full border rounded px-3 py-2"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Minimum importance score to trigger alerts
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Alert Spacing (minutes)
        </label>
        <input
          type="number"
          min="1"
          value={formData.alert_spacing_minutes}
          onChange={(e) => setFormData(prev => ({ ...prev, alert_spacing_minutes: parseInt(e.target.value) }))}
          className="w-full border rounded px-3 py-2"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Time window to spread alerts from same run (recommended: 80% of schedule interval)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Frequency Window (minutes)
        </label>
        <input
          type="number"
          min="1"
          value={formData.frequency_window_minutes}
          onChange={(e) => setFormData(prev => ({ ...prev, frequency_window_minutes: parseInt(e.target.value) }))}
          className="w-full border rounded px-3 py-2"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Don&apos;t send duplicate alerts within this window
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Alert Channels
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.channels.includes('email')}
              onChange={() => toggleChannel('email')}
              className="mr-2"
            />
            Email
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.channels.includes('slack')}
              onChange={() => toggleChannel('slack')}
              className="mr-2"
            />
            Slack
          </label>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded hover:bg-gray-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}

