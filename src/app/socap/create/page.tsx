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
    // Raw textarea inputs where users can paste many URLs with commas, spaces, or newlines
    maintweets_raw: '',
    influencer_twts_raw: '',
    investor_twts_raw: '',
  });

  function handleInputChange(field: string, value: any) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Extract tweet URLs from a free-form textarea string.
   *
   * Rules:
   * - Treat every occurrence of http:// or https:// as the start of a new URL
   * - Allow commas, spaces, and newlines before the URL
   * - Stop the URL at whitespace or a common delimiter like comma/semicolon/paren
   */
  function extractTweetUrls(input: string): string[] {
    if (!input) return [];

    const matches = input.match(/https?:\/\/\S+/g) || [];

    return matches
      .map((raw) => {
        // Trim common trailing punctuation that might be attached in CSV/notes
        let url = raw.trim();
        url = url.replace(/[),;]+$/g, '');
        return url;
      })
      .filter((url) => url.length > 0);
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
      // Extract tweet URLs from the raw textarea fields
      const maintweets = extractTweetUrls(formData.maintweets_raw).map((url) => ({
        url,
      }));
      const influencer_twts = extractTweetUrls(formData.influencer_twts_raw).map((url) => ({
        url,
      }));
      const investor_twts = extractTweetUrls(formData.investor_twts_raw).map((url) => ({
        url,
      }));

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

  // Set default dates (today and 10 days from now)
  const today = new Date().toISOString().split('T')[0];
  const tenDaysLater = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  if (!formData.start_date) {
    formData.start_date = today;
  }
  if (!formData.end_date) {
    formData.end_date = tenDaysLater;
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
              <textarea
                value={formData.maintweets_raw}
                onChange={(e) => handleInputChange('maintweets_raw', e.target.value)}
                className="w-full border rounded px-3 py-2 min-h-[80px]"
                placeholder={`Paste one or more tweet URLs.\nExamples:\nhttps://x.com/user/status/123\nhttps://twitter.com/user2/status/456, https://x.com/user3/status/789`}
              />
              <p className="text-xs text-gray-500 mt-1">
                You can separate URLs with newlines, spaces, or commas. Each
                occurrence of an http(s) URL will be treated as a separate tweet.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Influencer Tweets
              </label>
              <textarea
                value={formData.influencer_twts_raw}
                onChange={(e) => handleInputChange('influencer_twts_raw', e.target.value)}
                className="w-full border rounded px-3 py-2 min-h-[80px]"
                placeholder={`Paste influencer tweet URLs. Any text is fine as long as the URLs start with http(s)://`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Same rules: every http(s) URL is parsed as a separate influencer tweet.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Investor Tweets
              </label>
              <textarea
                value={formData.investor_twts_raw}
                onChange={(e) => handleInputChange('investor_twts_raw', e.target.value)}
                className="w-full border rounded px-3 py-2 min-h-[80px]"
                placeholder={`Paste investor tweet URLs here.`}
              />
              <p className="text-xs text-gray-500 mt-1">
                URLs can be separated by commas, spaces, or new lines.
              </p>
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

