'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Campaign {
  _id: string;
  launch_name: string;
  client_info: {
    name: string;
    email: string;
  };
  status: 'active' | 'paused' | 'completed';
  monitor_window: {
    start_date: string;
    end_date: string;
  };
  created_at: string;
}

export default function SocapCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      const response = await fetch('/api/socap/campaigns');
      const data = await response.json();
      
      if (data.success) {
        setCampaigns(data.data);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">SOCAP Campaigns</h1>
        <div className="flex gap-2">
          <Link
            href="/socap/settings"
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            System Settings
          </Link>
          <Link
            href="/socap/create"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create Campaign
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No campaigns yet</p>
          <Link
            href="/socap/create"
            className="text-blue-600 hover:underline"
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign._id}
              href={`/socap/campaigns/${campaign._id}`}
              className="block border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold mb-2">
                    {campaign.launch_name}
                  </h2>
                  <p className="text-gray-600 mb-2">
                    Client: {campaign.client_info.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(campaign.monitor_window.start_date).toLocaleDateString()} -{' '}
                    {new Date(campaign.monitor_window.end_date).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    campaign.status
                  )}`}
                >
                  {campaign.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

