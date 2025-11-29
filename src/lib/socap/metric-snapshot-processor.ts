import { getJobQueueStats } from './job-queue';
import { getTweetsByCampaign } from '../models/socap/tweets';
import { aggregateCampaignMetrics } from './metric-aggregator';

/**
 * Check if all metrics jobs for a campaign are completed
 * and create metric snapshot if so
 */
export async function processMetricSnapshots(campaignId: string): Promise<void> {
  const { getJobQueueCollection } = await import('./job-queue');
  const collection = await getJobQueueCollection();
  
  // Get all metrics jobs for this campaign
  const metricsJobs = await collection.find({
    campaign_id: campaignId,
    job_type: 'metrics',
  }).toArray();
  
  if (metricsJobs.length === 0) {
    return; // No metrics jobs yet
  }
  
  // Check if all metrics jobs are completed
  const allCompleted = metricsJobs.every(
    (job) => job.status === 'completed'
  );
  
  if (!allCompleted) {
    return; // Still processing
  }
  
  // Check if we already created a snapshot recently (within last hour)
  const { getLatestMetricSnapshot } = await import('../models/socap/metric-snapshots');
  const latestSnapshot = await getLatestMetricSnapshot(campaignId);
  
  if (latestSnapshot) {
    const snapshotTime = new Date(latestSnapshot.snapshot_time);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    if (snapshotTime > oneHourAgo) {
      // Already created snapshot recently
      return;
    }
  }
  
  // Create metric snapshot
  await aggregateCampaignMetrics(campaignId);
  console.log(`Created metric snapshot for campaign ${campaignId}`);
}

/**
 * Process metric snapshots for all active campaigns
 */
export async function processAllMetricSnapshots(): Promise<void> {
  const { getActiveCampaigns } = await import('../models/socap/campaigns');
  const activeCampaigns = await getActiveCampaigns();
  
  for (const campaign of activeCampaigns) {
    try {
      await processMetricSnapshots(campaign._id!);
    } catch (error) {
      console.error(`Error processing metric snapshot for campaign ${campaign._id}:`, error);
    }
  }
}

