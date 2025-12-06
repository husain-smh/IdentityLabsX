import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getActiveCampaigns } from '@/lib/models/socap/campaigns';
import { enqueueCampaignJobs } from '@/lib/socap/job-queue';
import { checkAndCompleteCampaigns } from '@/lib/socap/campaign-completion';

/**
 * POST /socap/workers/trigger
 * Trigger job processing for all active campaigns
 * Called by N8N on schedule (default: every 30 minutes, configurable)
 */
export async function POST() {
  try {
    // First, check and complete campaigns that have ended
    const completionStats = await checkAndCompleteCampaigns();
    console.log(`Campaign completion check: ${completionStats.completed} completed, ${completionStats.errors} errors`);
    
    // Get all active campaigns within monitor window
    const activeCampaigns = await getActiveCampaigns();
    
    console.log(`Worker trigger: Found ${activeCampaigns.length} active campaigns`);
    
    if (activeCampaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active campaigns to process',
        data: {
          campaigns_processed: 0,
          jobs_enqueued: 0,
        },
      });
    }
    
    // Enqueue jobs for each campaign
    let totalJobsEnqueued = 0;
    const results = [];
    
    for (const campaign of activeCampaigns) {
      try {
        // Convert campaign._id to string (MongoDB returns ObjectId at runtime, but tweets store campaign_id as string)
        // Type assertion needed: interface says string but MongoDB actually returns ObjectId
        const rawId = campaign._id as unknown;
        const campaignId = (rawId instanceof ObjectId ? rawId.toString() : String(campaign._id || ''));
        
        if (!campaignId) {
          throw new Error('Campaign ID is missing');
        }
        
        console.log(`Processing campaign: ${campaign.launch_name} (${campaignId})`);
        const jobsEnqueued = await enqueueCampaignJobs(campaignId);
        totalJobsEnqueued += jobsEnqueued;
        results.push({
          campaign_id: campaignId,
          campaign_name: campaign.launch_name,
          jobs_enqueued: jobsEnqueued,
          status: 'success',
        });
        console.log(`✓ Campaign ${campaign.launch_name}: ${jobsEnqueued} jobs enqueued`);
      } catch (error) {
        const rawId = campaign._id as unknown;
        const campaignId = (rawId instanceof ObjectId ? rawId.toString() : String(campaign._id || ''));
        console.error(`✗ Error enqueuing jobs for campaign ${campaignId}:`, error);
        results.push({
          campaign_id: campaignId,
          campaign_name: campaign.launch_name,
          jobs_enqueued: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    console.log(`Worker trigger complete: ${totalJobsEnqueued} total jobs enqueued across ${activeCampaigns.length} campaigns`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${activeCampaigns.length} campaigns`,
      data: {
        campaigns_processed: activeCampaigns.length,
        jobs_enqueued: totalJobsEnqueued,
        results,
      },
    });
  } catch (error) {
    console.error('Error triggering workers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger workers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

