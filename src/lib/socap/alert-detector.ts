import { getEngagementsByCampaign } from '../models/socap/engagements';
import { getCampaignById, Campaign } from '../models/socap/campaigns';
import { checkRecentAlert } from '../models/socap/alert-history';
import { createAlert, updateAlertLlmFields } from '../models/socap/alert-queue';
import { getTweetByTweetId } from '../models/socap/tweets';
import { generateQuoteNotifications } from './quote-notification-generator';

/**
 * Detect high-importance engagements and queue alerts
 */
export async function detectAndQueueAlerts(campaignId: string): Promise<number> {
  const campaign = await getCampaignById(campaignId);
  
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  
  // Get recent engagements (check all, deduplication handled by alert_history)
  const recentEngagements = await getEngagementsByCampaign(campaignId, {
    limit: 1000,
    sort: 'timestamp',
    min_importance: campaign.alert_preferences.importance_threshold,
  });
  
  // Filter to only new engagements since last check
  // For simplicity, we'll check all recent engagements
  // In production, you might want to track last check time
  
  // Get interval from database (system settings) or environment variable
  // This should match your N8N schedule interval
  const { getScheduleIntervalMinutes } = await import('../models/socap/system-settings');
  const scheduleIntervalMinutes = await getScheduleIntervalMinutes();
  const runBatch = getCurrentRunBatch(scheduleIntervalMinutes);
  // Default alert spacing: 80% of schedule interval (e.g., 4 min for 5-min interval, 16 min for 20-min interval)
  // This ensures alerts from one run are sent before the next run starts
  const defaultAlertSpacing = Math.max(2, Math.floor(scheduleIntervalMinutes * 0.8));
  const alertSpacingMinutes = campaign.alert_preferences.alert_spacing_minutes || defaultAlertSpacing;
  
  let alertsQueued = 0;
  const quoteAlertContexts = new Map<string, QuoteAlertContext[]>();
  
  for (const engagement of recentEngagements) {
    // Check if we've sent an alert for this user/action recently
    const recentAlert = await checkRecentAlert(
      campaignId,
      engagement.user_id,
      engagement.action_type,
      engagement.timestamp,
      campaign.alert_preferences.frequency_window_minutes || 30
    );
    
    if (recentAlert) {
      // Skip - already sent alert recently
      continue;
    }
    
    // Check if importance score meets threshold
    if (engagement.importance_score < campaign.alert_preferences.importance_threshold) {
      continue;
    }
    
    // Calculate scheduled send time (distribute over alert spacing window)
    const baseTime = new Date();
    const randomOffset = Math.random() * alertSpacingMinutes * 60 * 1000; // Random within window
    const scheduledSendTime = new Date(baseTime.getTime() + randomOffset);
    
    // Queue alert - normalize engagement_id to string to ensure
    // consistent deduplication and unique index behavior
    const alert = await createAlert({
      campaign_id: campaignId,
      engagement_id: String(engagement._id!),
      user_id: engagement.user_id,
      action_type: engagement.action_type,
      importance_score: engagement.importance_score,
      run_batch: runBatch,
      scheduled_send_time: scheduledSendTime,
    });
    
    alertsQueued++;

    if (engagement.action_type === 'quote' && engagement._id) {
      const tweetContexts = quoteAlertContexts.get(engagement.tweet_id) || [];
      const account = engagement.account_profile;
      tweetContexts.push({
        alertId: String(alert._id!),
        engagementId: String(engagement._id),
        tweetId: engagement.tweet_id,
        importanceScore: engagement.importance_score,
        accountProfile: {
          username: account.username,
          name: account.name,
          followers: account.followers,
          verified: account.verified,
          bio: account.bio,
        },
        quoteText: engagement.text,
        timestamp: engagement.timestamp,
      });
      quoteAlertContexts.set(engagement.tweet_id, tweetContexts);
    }
  }

  for (const [tweetId, contexts] of quoteAlertContexts.entries()) {
    await processQuoteAlertContexts(campaign, tweetId, contexts);
  }
  
  return alertsQueued;
}

/**
 * Get current run batch identifier (rounded to interval)
 * Interval is configurable via System Settings UI (/socap/settings) or SOCAP_SCHEDULE_INTERVAL_MINUTES env var (default: 30 minutes)
 */
function getCurrentRunBatch(intervalMinutes: number = 30): string {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
  const rounded = new Date(now);
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded.toISOString();
}

interface QuoteAlertContext {
  alertId: string;
  engagementId: string;
  tweetId: string;
  importanceScore: number;
  accountProfile: {
    username: string;
    name: string;
    followers: number;
    verified: boolean;
    bio?: string;
  };
  quoteText?: string;
  timestamp: Date;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function processQuoteAlertContexts(
  campaign: Campaign,
  tweetId: string,
  contexts: QuoteAlertContext[]
): Promise<void> {
  if (contexts.length === 0) {
    return;
  }

  const tweet = await getTweetByTweetId(tweetId);
  if (!tweet) {
    return;
  }

  const chunks = chunk(contexts, 5);

  for (const group of chunks) {
    const promptPayload = {
      campaignName: campaign.launch_name,
      mainTweet: {
        authorName: tweet.author_name,
        authorUsername: tweet.author_username,
        text: tweet.text,
        url: tweet.tweet_url,
      },
      quotes: group.map((ctx) => ({
        engagementId: ctx.engagementId,
        accountName: ctx.accountProfile.name || ctx.accountProfile.username,
        accountUsername: ctx.accountProfile.username,
        followers: ctx.accountProfile.followers,
        importanceScore: ctx.importanceScore,
        verified: ctx.accountProfile.verified,
        accountBio: ctx.accountProfile.bio,
        quoteText: ctx.quoteText,
        timestampISO: ctx.timestamp.toISOString(),
      })),
    };

    try {
      const suggestions = await generateQuoteNotifications(promptPayload);
      if (!suggestions.length) {
        continue;
      }

      const ctxByEngagement = new Map(group.map((ctx) => [ctx.engagementId, ctx]));

      for (const suggestion of suggestions) {
        const matchedContexts = suggestion.engagementIds
          .map((id) => ctxByEngagement.get(id))
          .filter((ctx): ctx is QuoteAlertContext => Boolean(ctx));

        if (matchedContexts.length === 0) {
          continue;
        }

        const parentCtx = matchedContexts.reduce((prev, current) =>
          current.importanceScore > prev.importanceScore ? current : prev
        );

        await updateAlertLlmFields(parentCtx.alertId, {
          llm_copy: suggestion.notification,
          llm_sentiment: suggestion.sentiment,
          llm_group_parent_id: null,
          llm_generated_at: new Date(),
        });

        for (const ctx of matchedContexts) {
          if (ctx.alertId === parentCtx.alertId) {
            continue;
          }

          await updateAlertLlmFields(ctx.alertId, {
            llm_copy: undefined,
            llm_sentiment: undefined,
            llm_group_parent_id: parentCtx.alertId,
            llm_generated_at: new Date(),
          });
        }
      }
    } catch (error) {
      console.error(
        `[QuoteNotifications] Failed to generate notifications for campaign ${campaign._id} tweet ${tweetId}:`,
        error
      );
    }
  }
}

