'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, PauseCircle, Play, Pin } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    action: 'delete' | 'pause' | 'resume';
    campaign: Campaign;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      setError(null);
      const response = await fetch('/api/socap/campaigns');
      const data = await response.json();
      
      if (data.success) {
        setCampaigns(data.data || []);
      } else {
        setError(data.error || 'Failed to load campaigns');
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setError('Failed to connect to the server. Please check your connection.');
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

  const openConfirm = (action: 'delete' | 'pause' | 'resume', campaign: Campaign) => {
    setActionError(null);
    setConfirmModal({ action, campaign });
  };

  const closeConfirm = () => {
    if (actionLoading) return;
    setConfirmModal(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    setActionLoading(true);
    setActionError(null);

    try {
      let response: Response;

      if (confirmModal.action === 'delete') {
        response = await fetch(`/api/socap/campaigns/${confirmModal.campaign._id}`, {
          method: 'DELETE',
        });
      } else {
        const status = confirmModal.action === 'pause' ? 'paused' : 'active';
        response = await fetch(`/api/socap/campaigns/${confirmModal.campaign._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
      }

      const result = await response.json();

      if (!result.success) {
        setActionError(result.error || 'Action failed. Please try again.');
        return;
      }

      if (confirmModal.action === 'delete') {
        setCampaigns((prev) => prev.filter((c) => c._id !== confirmModal.campaign._id));
      } else {
        const status = confirmModal.action === 'pause' ? 'paused' : 'active';
        setCampaigns((prev) =>
          prev.map((c) => (c._id === confirmModal.campaign._id ? { ...c, status } : c))
        );
      }

      setConfirmModal(null);
    } catch (error) {
      console.error('Error updating campaign:', error);
      setActionError('Something went wrong while processing the request.');
    } finally {
      setActionLoading(false);
    }
  };

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

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-semibold mb-2">Error loading campaigns</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchCampaigns}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : campaigns.length === 0 ? (
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
            <div
              key={campaign._id}
              className="border rounded-lg p-6 hover:shadow-lg transition-shadow bg-white"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <Link
                    href={`/socap/campaigns/${campaign._id}`}
                    className="text-xl font-semibold mb-2 inline-block hover:text-blue-700"
                  >
                    {campaign.launch_name}
                  </Link>
                  <p className="text-gray-600 mb-2">
                    Client: {campaign.client_info.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(campaign.monitor_window.start_date).toLocaleDateString()} -{' '}
                    {new Date(campaign.monitor_window.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      campaign.status
                    )}`}
                  >
                    {campaign.status}
                  </span>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/socap/campaigns/${campaign._id}/edit`}
                      className="inline-flex items-center gap-2 border border-indigo-500 text-indigo-600 px-3 py-2 rounded hover:border-indigo-600 hover:text-indigo-700 text-sm bg-white"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Link>
                    {campaign.status === 'active' ? (
                      <button
                        onClick={() => openConfirm('pause', campaign)}
                        className="inline-flex items-center gap-2 border border-yellow-500 text-yellow-600 px-3 py-2 rounded hover:border-yellow-600 hover:text-yellow-700 text-sm bg-white"
                      >
                        <PauseCircle className="w-4 h-4" />
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={() => openConfirm('resume', campaign)}
                        className="inline-flex items-center gap-2 border border-green-500 text-green-600 px-3 py-2 rounded hover:border-green-600 hover:text-green-700 text-sm bg-white"
                      >
                        <Play className="w-4 h-4" />
                        Resume
                      </button>
                    )}
                    <button
                      onClick={() => openConfirm('delete', campaign)}
                      className="inline-flex items-center gap-2 border border-red-500 text-red-600 px-3 py-2 rounded hover:border-red-600 hover:text-red-700 text-sm bg-white"
                    >
                      <Pin className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">
              {confirmModal.action === 'delete'
                ? 'Delete Campaign'
                : confirmModal.action === 'pause'
                ? 'Pause Campaign'
                : 'Resume Campaign'}
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              {confirmModal.action === 'delete'
                ? 'This will permanently remove the campaign.'
                : confirmModal.action === 'pause'
                ? 'The campaign will stop processing new engagements.'
                : 'The campaign will resume processing engagements.'}{' '}
              <span className="font-semibold">&ldquo;{confirmModal.campaign.launch_name}&rdquo;</span>
            </p>
            {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeConfirm}
                disabled={actionLoading}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:border-gray-400 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className="px-4 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

