'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface AlertEngagementProfile {
  username: string;
  name: string;
  followers: number;
  verified: boolean;
}

interface AlertEngagement {
  _id: string;
  action_type: 'retweet' | 'reply' | 'quote';
  timestamp: string;
  importance_score: number;
  account_profile: AlertEngagementProfile;
  account_categories: string[];
}

interface AlertItem {
  _id: string;
  campaign_id: string;
  engagement_id: string;
  user_id: string;
  action_type: 'retweet' | 'reply' | 'quote';
  importance_score: number;
  run_batch: string;
  scheduled_send_time: string;
  status: 'pending' | 'sent' | 'skipped';
  sent_at: string | null;
  created_at: string;
  engagement: AlertEngagement | null;
}

interface AlertHistoryItem {
  _id: string;
  campaign_id: string;
  user_id: string;
  action_type: 'retweet' | 'reply' | 'quote';
  timestamp_hour: string;
  sent_at: string;
  channel: 'slack' | 'email';
}

interface AlertsApiResponse {
  alerts: AlertItem[];
  history: AlertHistoryItem[];
}

export default function CampaignAlertsPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const [data, setData] = useState<AlertsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        setLoading(true);
        const response = await fetch(`/api/socap/campaigns/${campaignId}/alerts`);
        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load alerts');
        }
      } catch (err) {
        console.error('Error loading alerts:', err);
        setError('Failed to load alerts');
      } finally {
        setLoading(false);
      }
    }

    if (campaignId) {
      fetchAlerts();
    }
  }, [campaignId]);

  async function handleSendSlack(alertId: string) {
    try {
      setSendingAlertId(alertId);
      const response = await fetch('/api/socap/alerts/send-slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(`Failed to generate Slack preview: ${result.error || 'Unknown error'}`);
        return;
      }

      alert('Slack notification preview generated. Check server logs for full payload.');
    } catch (err) {
      console.error('Error sending Slack preview:', err);
      alert('Failed to generate Slack preview');
    } finally {
      setSendingAlertId(null);
    }
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  function humanActionLabel(action: AlertItem['action_type']) {
    if (action === 'retweet') return 'Retweeted';
    if (action === 'reply') return 'Replied';
    if (action === 'quote') return 'Quote-tweeted';
    return action;
  }

  function buildNotificationPreview(alert: AlertItem): string | null {
    const engagement = alert.engagement;
    if (!engagement) return null;

    const profile = engagement.account_profile;
    const name = profile.name || profile.username || 'Someone';
    const username = profile.username || '';

    const actionText =
      alert.action_type === 'retweet'
        ? 'retweeted'
        : alert.action_type === 'reply'
        ? 'replied to'
        : alert.action_type === 'quote'
        ? 'quote-tweeted'
        : 'engaged with';

    // Client-facing preview: no importance score
    return `${name}${username ? ` (@${username})` : ''} ${actionText} your post.`;
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading alerts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">No alert data available for this campaign.</div>
      </div>
    );
  }

  const pendingAlerts = data.alerts.filter((a) => a.status === 'pending');
  const sentOrSkippedAlerts = data.alerts.filter((a) => a.status !== 'pending');

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/socap/campaigns/${campaignId}`} className="text-blue-600 hover:underline">
            ← Back to Campaign Dashboard
          </Link>
          <h1 className="text-3xl font-bold mt-2">Campaign Alerts</h1>
          <p className="text-gray-600 mt-1">
            Visualize how notifications are formed, when they are generated, and how they are spaced.
          </p>
        </div>
      </div>

      {/* Pending alerts (not yet sent) */}
      <section>
        <h2 className="text-2xl font-semibold mb-3">Pending Alerts (Queued Notifications)</h2>
        <p className="text-sm text-gray-600 mb-4">
          These alerts have been generated but not yet processed by the sender. Each card shows:
          the high-importance engager, when the alert was generated, and when it is scheduled to be sent.
        </p>

        {pendingAlerts.length === 0 ? (
          <div className="text-gray-500">No pending alerts for this campaign.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pendingAlerts.map((alert) => {
              const engagement = alert.engagement;
              const preview = buildNotificationPreview(alert);
              return (
                <div
                  key={alert._id}
                  className="border rounded-lg p-4 bg-white shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-500 mb-1">
                      {humanActionLabel(alert.action_type)} • Importance {alert.importance_score}
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-lg">
                          {engagement
                            ? `@${engagement.account_profile.username}`
                            : 'Unknown account'}
                        </div>
                        {engagement && (
                          <div className="text-sm text-gray-600">
                            {engagement.account_profile.name}{' '}
                            {engagement.account_profile.verified && (
                              <span className="ml-1 text-xs text-blue-600 border border-blue-200 rounded px-1">
                                Verified
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {engagement && (
                        <div className="text-right text-sm text-gray-600">
                          <div>{engagement.account_profile.followers.toLocaleString()} followers</div>
                          <div className="text-xs text-gray-500">
                            Categories: {engagement.account_categories.join(', ') || 'N/A'}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 space-y-1 text-sm">
                      {preview && (
                        <div className="mb-2">
                          <div className="text-sm font-medium text-gray-700 mb-0.5">
                            Notification
                          </div>
                          <div className="text-base text-gray-900">
                            {preview}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedAlertId((current) =>
                            current === alert._id ? null : alert._id
                          )
                        }
                        className="mt-1 text-xs text-blue-600 hover:underline"
                      >
                        {expandedAlertId === alert._id ? 'Hide details' : 'Show details'}
                      </button>
                      {expandedAlertId === alert._id && (
                        <div className="mt-2 space-y-1 border-t pt-2">
                          <div>
                            <span className="font-medium text-gray-700">Engagement Time:</span>{' '}
                            <span className="text-gray-700">
                              {engagement ? formatDate(engagement.timestamp) : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Notification Generated At:</span>{' '}
                            <span className="text-gray-700">{formatDate(alert.created_at)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Scheduled Send Time:</span>{' '}
                            <span className="text-gray-700">{formatDate(alert.scheduled_send_time)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Run Batch:</span>{' '}
                            <span className="text-gray-700">{formatDate(alert.run_batch)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Status: <span className="font-semibold text-yellow-600">Pending</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendSlack(alert._id)}
                      disabled={sendingAlertId === alert._id}
                      className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {sendingAlertId === alert._id ? 'Previewing…' : 'Send on Slack (Preview)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Already processed alerts from queue */}
      <section>
        <h2 className="text-2xl font-semibold mb-3">Processed Alerts (From Queue)</h2>
        <p className="text-sm text-gray-600 mb-4">
          These alerts were generated earlier and have already been marked as sent or skipped by the
          sender process. Useful to understand historical spacing and generation times.
        </p>

        {sentOrSkippedAlerts.length === 0 ? (
          <div className="text-gray-500">No processed alerts in the queue for this campaign.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {sentOrSkippedAlerts.map((alert) => (
              <div
                key={alert._id}
                className="flex items-center justify-between border rounded px-3 py-2 bg-gray-50"
              >
                <div>
                  <div className="font-medium text-gray-800">
                    {humanActionLabel(alert.action_type)} • Importance {alert.importance_score}
                  </div>
                  <div className="text-xs text-gray-600">
                    Generated: {formatDate(alert.created_at)} • Scheduled:{' '}
                    {formatDate(alert.scheduled_send_time)} • Sent:{' '}
                    {formatDate(alert.sent_at)}
                  </div>
                </div>
                <div className="text-xs font-semibold">
                  {alert.status === 'sent' && <span className="text-green-600">Sent</span>}
                  {alert.status === 'skipped' && <span className="text-gray-500">Skipped</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Alert history (dedup + channels) */}
      <section>
        <h2 className="text-2xl font-semibold mb-3">Alert History (Per Channel)</h2>
        <p className="text-sm text-gray-600 mb-4">
          This is the canonical history used for deduplication. It shows, per channel, when alerts
          were actually sent to the outside world.
        </p>

        {data.history.length === 0 ? (
          <div className="text-gray-500">No alert history for this campaign yet.</div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-3 py-2">User ID</th>
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">Channel</th>
                  <th className="text-left px-3 py-2">Hour Bucket</th>
                  <th className="text-left px-3 py-2">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((item) => (
                  <tr key={item._id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">
                      {item.user_id}
                    </td>
                    <td className="px-3 py-2">{humanActionLabel(item.action_type)}</td>
                    <td className="px-3 py-2 capitalize">{item.channel}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {formatDate(item.timestamp_hour)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {formatDate(item.sent_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


