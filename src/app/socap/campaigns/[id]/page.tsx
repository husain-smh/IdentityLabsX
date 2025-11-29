'use client';

import { useEffect, useState } from 'react';
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
  Legend,
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

export default function CampaignDashboardPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsData, setMetricsData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboard();
    fetchMetrics();
    
    // Auto-refresh every minute
    const interval = setInterval(() => {
      fetchDashboard();
      fetchMetrics();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [campaignId]);

  async function fetchDashboard() {
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
  }

  async function fetchMetrics() {
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

  const chartData = metricsData.map((snapshot) => ({
    time: new Date(snapshot.snapshot_time).toLocaleString(),
    likes: snapshot.total_likes,
    retweets: snapshot.total_retweets,
    quotes: snapshot.total_quotes,
    replies: snapshot.total_replies,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/socap" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Campaigns
        </Link>
        <h1 className="text-3xl font-bold">{data.campaign.launch_name}</h1>
        <p className="text-gray-600 mt-2">
          Client: {data.campaign.client_info.name} | Status:{' '}
          <span className="font-semibold">{data.campaign.status}</span>
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Likes</div>
          <div className="text-2xl font-bold">{data.metrics.total_likes.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Retweets</div>
          <div className="text-2xl font-bold">{data.metrics.total_retweets.toLocaleString()}</div>
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

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Metrics Chart */}
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Metrics Over Time</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="likes" stroke="#8884d8" />
                <Line type="monotone" dataKey="retweets" stroke="#82ca9d" />
                <Line type="monotone" dataKey="quotes" stroke="#ffc658" />
                <Line type="monotone" dataKey="replies" stroke="#ff7300" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-12">
              No metrics data yet
            </div>
          )}
        </div>

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
                <Tooltip />
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
    </div>
  );
}

