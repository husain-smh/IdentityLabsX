'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface CampaignData {
  campaign: any;
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
    };
  }>;
}

type TweetCategory = 'main_twt' | 'influencer_twt' | 'investor_twt';

const CATEGORY_LABELS: Record<TweetCategory, string> = {
  main_twt: 'Main Tweet',
  influencer_twt: 'Influencer Tweet',
  investor_twt: 'Investor Tweet',
};

const CATEGORY_COLORS: Record<TweetCategory, string> = {
  main_twt: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  influencer_twt: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  investor_twt: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const [data, setData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state for alert preferences
  const [settingsForm, setSettingsForm] = useState({
    importance_threshold: 10,
    alert_spacing_minutes: 20,
    frequency_window_minutes: 30,
    channels: ['email'] as string[],
  });

  // Form state for new tweets to add
  const [newTweets, setNewTweets] = useState<{
    maintweets_raw: string;
    influencer_twts_raw: string;
    investor_twts_raw: string;
  }>({
    maintweets_raw: '',
    influencer_twts_raw: '',
    investor_twts_raw: '',
  });

  const fetchCampaignData = useCallback(async () => {
    try {
      const response = await fetch(`/api/socap/campaigns/${campaignId}/dashboard`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        // Initialize settings form from campaign data
        if (result.data.campaign?.alert_preferences) {
          setSettingsForm({
            importance_threshold: result.data.campaign.alert_preferences.importance_threshold || 10,
            alert_spacing_minutes: result.data.campaign.alert_preferences.alert_spacing_minutes || 20,
            frequency_window_minutes: result.data.campaign.alert_preferences.frequency_window_minutes || 30,
            channels: result.data.campaign.alert_preferences.channels || ['email'],
          });
        }
      }
    } catch (error) {
      console.error('Error fetching campaign data:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaignData();
  }, [fetchCampaignData]);

  function handleSettingsChange(field: keyof typeof settingsForm, value: any) {
    setSettingsForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleChannel(channel: string) {
    setSettingsForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c: string) => c !== channel)
        : [...prev.channels, channel],
    }));
  }

  /**
   * Extract tweet URLs from a free-form textarea string.
   */
  function extractTweetUrls(input: string): string[] {
    if (!input) return [];

    const matches = input.match(/https?:\/\/\S+/g) || [];

    return matches
      .map((raw) => {
        let url = raw.trim();
        url = url.replace(/[),;]+$/g, '');
        return url;
      })
      .filter((url) => url.length > 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      // Get existing tweet URLs
      const existingTweets = {
        main_twt: [] as string[],
        influencer_twt: [] as string[],
        investor_twt: [] as string[],
      };

      if (data?.tweets) {
        for (const tweet of data.tweets) {
          const url = `https://x.com/${tweet.author_username}/status/${tweet.tweet_id}`;
          existingTweets[tweet.category].push(url);
        }
      }

      // Extract new tweet URLs from form
      const newMainTweets = extractTweetUrls(newTweets.maintweets_raw);
      const newInfluencerTweets = extractTweetUrls(newTweets.influencer_twts_raw);
      const newInvestorTweets = extractTweetUrls(newTweets.investor_twts_raw);

      // Combine existing and new tweets
      const allMainTweets = [
        ...existingTweets.main_twt,
        ...newMainTweets,
      ].map((url) => ({ url }));

      const allInfluencerTweets = [
        ...existingTweets.influencer_twt,
        ...newInfluencerTweets,
      ].map((url) => ({ url }));

      const allInvestorTweets = [
        ...existingTweets.investor_twt,
        ...newInvestorTweets,
      ].map((url) => ({ url }));

      const totalUrls =
        allMainTweets.length + allInfluencerTweets.length + allInvestorTweets.length;

      if (totalUrls === 0) {
        alert('Please add at least one tweet URL before updating the campaign.');
        setSaving(false);
        return;
      }

      // Update campaign
      const response = await fetch(`/api/socap/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_preferences: settingsForm,
          maintweets: allMainTweets,
          influencer_twts: allInfluencerTweets,
          investor_twts: allInvestorTweets,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Campaign updated successfully');
        router.push(`/socap/campaigns/${campaignId}`);
      } else {
        alert(`Failed to update: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating campaign:', error);
      alert('Failed to update campaign');
    } finally {
      setSaving(false);
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
            <p className="mt-4 text-zinc-400">Loading campaign...</p>
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

  // Group tweets by category
  const tweetsByCategory = {
    main_twt: data.tweets?.filter((t) => t.category === 'main_twt') || [],
    influencer_twt: data.tweets?.filter((t) => t.category === 'influencer_twt') || [],
    investor_twt: data.tweets?.filter((t) => t.category === 'investor_twt') || [],
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      
      <div className="relative z-10">
        <div className="pt-24 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link 
              href={`/socap/campaigns/${campaignId}`} 
              className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm mb-6 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Campaign
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          {/* Header */}
          <div className="glass rounded-2xl p-6 mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              Edit Campaign: {data.campaign.launch_name}
            </h1>
            <p className="text-sm text-zinc-400">
              Client: {data.campaign.client_info.name}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Existing Tweets Display */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white">Existing Tweets</h2>
                <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-medium">
                  Protected - Cannot be deleted
                </div>
              </div>
              <p className="text-sm text-zinc-400 mb-4">
                All existing tweets and their engagement data are preserved. You can only add new tweets below.
              </p>
              
              {data.tweets && data.tweets.length > 0 ? (
                <div className="space-y-6">
                  {(['main_twt', 'influencer_twt', 'investor_twt'] as TweetCategory[]).map((category) => {
                    const tweets = tweetsByCategory[category];
                    if (tweets.length === 0) return null;

                    return (
                      <div key={category}>
                        <h3 className="text-lg font-medium text-zinc-300 mb-4 flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${CATEGORY_COLORS[category]}`}>
                            {CATEGORY_LABELS[category]}
                          </span>
                          <span className="text-zinc-500 text-sm">
                            ({tweets.length} {tweets.length === 1 ? 'tweet' : 'tweets'})
                          </span>
                        </h3>
                        <div className="grid gap-3">
                          {tweets.map((tweet) => {
                            const tweetUrl = `https://x.com/${tweet.author_username}/status/${tweet.tweet_id}`;
                            return (
                              <div
                                key={tweet.tweet_id}
                                className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <a
                                      href={tweetUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-400 hover:text-indigo-300 text-sm font-mono break-all hover:underline"
                                    >
                                      {tweetUrl}
                                    </a>
                                    <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                                      <span>@{tweet.author_username}</span>
                                      {tweet.metrics && (
                                        <>
                                          <span>❤️ {tweet.metrics.likeCount.toLocaleString()}</span>
                                          <span>🔄 {tweet.metrics.retweetCount.toLocaleString()}</span>
                                          <span>💬 {tweet.metrics.replyCount.toLocaleString()}</span>
                                          <span>🔁 {tweet.metrics.quoteCount.toLocaleString()}</span>
                                          <span>👁️ {tweet.metrics.viewCount.toLocaleString()}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-zinc-400 py-12">
                  <p>No tweets added to this campaign yet.</p>
                  <p className="text-sm mt-2">Add tweets below to get started.</p>
                </div>
              )}
            </div>

            {/* Add New Tweets */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-2xl font-semibold text-white mb-6">Add New Tweets</h2>
              <p className="text-sm text-zinc-400 mb-6">
                Paste tweet URLs below to add them to the campaign. Existing tweets will be preserved.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Main Tweets
                  </label>
                  <textarea
                    value={newTweets.maintweets_raw}
                    onChange={(e) =>
                      setNewTweets((prev) => ({ ...prev, maintweets_raw: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all min-h-[100px] font-mono text-sm"
                    placeholder={`Paste one or more main tweet URLs.\nExamples:\nhttps://x.com/user/status/123\nhttps://twitter.com/user2/status/456, https://x.com/user3/status/789`}
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    You can separate URLs with newlines, spaces, or commas. Each occurrence of an http(s) URL will be treated as a separate tweet.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Influencer Tweets
                  </label>
                  <textarea
                    value={newTweets.influencer_twts_raw}
                    onChange={(e) =>
                      setNewTweets((prev) => ({ ...prev, influencer_twts_raw: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all min-h-[100px] font-mono text-sm"
                    placeholder={`Paste influencer tweet URLs. Any text is fine as long as the URLs start with http(s)://`}
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Same rules: every http(s) URL is parsed as a separate influencer tweet.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Investor Tweets
                  </label>
                  <textarea
                    value={newTweets.investor_twts_raw}
                    onChange={(e) =>
                      setNewTweets((prev) => ({ ...prev, investor_twts_raw: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all min-h-[100px] font-mono text-sm"
                    placeholder={`Paste investor tweet URLs here.`}
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    URLs can be separated by commas, spaces, or new lines.
                  </p>
                </div>
              </div>
            </div>

            {/* Alert Settings */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-2xl font-semibold text-white mb-6">Alert Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Importance Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settingsForm.importance_threshold}
                    onChange={(e) =>
                      handleSettingsChange(
                        'importance_threshold',
                        parseInt(e.target.value || '0', 10)
                      )
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                    required
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Minimum importance score to trigger alerts
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Alert Spacing (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settingsForm.alert_spacing_minutes}
                    onChange={(e) =>
                      handleSettingsChange(
                        'alert_spacing_minutes',
                        parseInt(e.target.value || '0', 10)
                      )
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                    required
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Time window to spread alerts from same run (recommended: 80% of schedule interval)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Frequency Window (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settingsForm.frequency_window_minutes}
                    onChange={(e) =>
                      handleSettingsChange(
                        'frequency_window_minutes',
                        parseInt(e.target.value || '0', 10)
                      )
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                    required
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Don&apos;t send duplicate alerts within this window
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Alert Channels
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center text-zinc-300">
                      <input
                        type="checkbox"
                        checked={settingsForm.channels.includes('email')}
                        onChange={() => toggleChannel('email')}
                        className="mr-2 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 focus:ring-2"
                      />
                      Email
                    </label>
                    <label className="flex items-center text-zinc-300">
                      <input
                        type="checkbox"
                        checked={settingsForm.channels.includes('slack')}
                        onChange={() => toggleChannel('slack')}
                        className="mr-2 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 focus:ring-2"
                      />
                      Slack
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Link
                href={`/socap/campaigns/${campaignId}`}
                className="px-6 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition-colors font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

