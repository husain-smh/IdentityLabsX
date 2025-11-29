'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    launch_name: '',
    client_name: '',
    client_email: '',
    importance_threshold: '10',
    frequency_window_minutes: '30',
    alert_spacing_minutes: '20',
    channels: ['email'] as string[],
    start_date: '',
    end_date: '',
    maintweets: [''] as string[],
    influencer_twts: [''] as string[],
    investor_twts: [''] as string[],
  });

  function handleInputChange(field: string, value: any) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleArrayChange(field: 'maintweets' | 'influencer_twts' | 'investor_twts', index: number, value: string) {
    setFormData((prev) => {
      const newArray = [...prev[field]];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  }

  function addTweetField(field: 'maintweets' | 'influencer_twts' | 'investor_twts') {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  }

  function removeTweetField(field: 'maintweets' | 'influencer_twts' | 'investor_twts', index: number) {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  }

  function handleChannelToggle(channel: string) {
    setFormData((prev) => {
      const channels = prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel];
      return { ...prev, channels };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Filter out empty tweet URLs
      const maintweets = formData.maintweets
        .filter((url) => url.trim())
        .map((url) => ({ url: url.trim() }));
      const influencer_twts = formData.influencer_twts
        .filter((url) => url.trim())
        .map((url) => ({ url: url.trim() }));
      const investor_twts = formData.investor_twts
        .filter((url) => url.trim())
        .map((url) => ({ url: url.trim() }));

      if (maintweets.length === 0 && influencer_twts.length === 0 && investor_twts.length === 0) {
        setError('Please add at least one tweet URL');
        setLoading(false);
        return;
      }

      const payload = {
        launch_name: formData.launch_name,
        client_info: {
          name: formData.client_name,
          email: formData.client_email,
        },
        maintweets,
        influencer_twts,
        investor_twts,
        monitor_window: {
          start_date: new Date(formData.start_date).toISOString(),
          end_date: new Date(formData.end_date).toISOString(),
        },
        alert_preferences: {
          importance_threshold: parseInt(formData.importance_threshold, 10),
          channels: formData.channels,
          frequency_window_minutes: parseInt(formData.frequency_window_minutes, 10),
          alert_spacing_minutes: parseInt(formData.alert_spacing_minutes, 10),
        },
      };

      const response = await fetch('/api/socap/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      // Redirect to campaign dashboard
      router.push(`/socap/campaigns/${data.data.campaign._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
      setLoading(false);
    }
  }

  // Set default dates (today and 3 days from now)
  const today = new Date().toISOString().split('T')[0];
  const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  if (!formData.start_date) {
    formData.start_date = today;
  }
  if (!formData.end_date) {
    formData.end_date = threeDaysLater;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/socap" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Campaigns
        </Link>
        <h1 className="text-3xl font-bold">Create New Campaign</h1>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-6">
        {/* Campaign Info */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Campaign Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Launch Name *
              </label>
              <input
                type="text"
                required
                value={formData.launch_name}
                onChange={(e) => handleInputChange('launch_name', e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., Product Launch Q1 2025"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Client Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.client_email}
                  onChange={(e) => handleInputChange('client_email', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Monitor Window */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Monitor Window</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                End Date *
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Tweet URLs */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Tweet URLs</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Main Tweets
              </label>
              {formData.maintweets.map((url, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleArrayChange('maintweets', index, e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="https://twitter.com/user/status/123456"
                  />
                  {formData.maintweets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTweetField('maintweets', index)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addTweetField('maintweets')}
                className="text-blue-600 hover:underline text-sm"
              >
                + Add Main Tweet
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Influencer Tweets
              </label>
              {formData.influencer_twts.map((url, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleArrayChange('influencer_twts', index, e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="https://twitter.com/user/status/123456"
                  />
                  {formData.influencer_twts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTweetField('influencer_twts', index)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addTweetField('influencer_twts')}
                className="text-blue-600 hover:underline text-sm"
              >
                + Add Influencer Tweet
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Investor Tweets
              </label>
              {formData.investor_twts.map((url, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleArrayChange('investor_twts', index, e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="https://twitter.com/user/status/123456"
                  />
                  {formData.investor_twts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTweetField('investor_twts', index)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addTweetField('investor_twts')}
                className="text-blue-600 hover:underline text-sm"
              >
                + Add Investor Tweet
              </button>
            </div>
          </div>
        </div>

        {/* Alert Preferences */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Alert Preferences</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Importance Threshold *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.importance_threshold}
                onChange={(e) => handleInputChange('importance_threshold', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum importance score to trigger alerts (default: 10)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Alert Channels *
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.channels.includes('email')}
                    onChange={() => handleChannelToggle('email')}
                    className="mr-2"
                  />
                  Email
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.channels.includes('slack')}
                    onChange={() => handleChannelToggle('slack')}
                    className="mr-2"
                  />
                  Slack
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Frequency Window (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.frequency_window_minutes}
                  onChange={(e) => handleInputChange('frequency_window_minutes', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Alert Spacing (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.alert_spacing_minutes}
                  onChange={(e) => handleInputChange('alert_spacing_minutes', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
          <Link
            href="/socap"
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

