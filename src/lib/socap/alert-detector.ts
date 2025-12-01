import { getEngagementsByCampaign } from '../models/socap/engagements';
import { getCampaignById } from '../models/socap/campaigns';
import { checkRecentAlert } from '../models/socap/alert-history';
import { createAlert } from '../models/socap/alert-queue';

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
    await createAlert({
      campaign_id: campaignId,
      engagement_id: String(engagement._id!),
      user_id: engagement.user_id,
      action_type: engagement.action_type,
      importance_score: engagement.importance_score,
      run_batch: runBatch,
      scheduled_send_time: scheduledSendTime,
    });
    
    alertsQueued++;
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

