import { NextRequest, NextResponse } from 'next/server';
import { getActiveCampaigns } from '@/lib/models/socap/campaigns';
import { enqueueCampaignJobs } from '@/lib/socap/job-queue';
import { checkAndCompleteCampaigns } from '@/lib/socap/campaign-completion';

/**
 * POST /socap/workers/trigger
 * Trigger job processing for all active campaigns
 * Called by N8N on schedule (default: every 30 minutes, configurable)
 */
export async function POST(request: NextRequest) {
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
        console.log(`Processing campaign: ${campaign.launch_name} (${campaign._id})`);
        const jobsEnqueued = await enqueueCampaignJobs(campaign._id!);
        totalJobsEnqueued += jobsEnqueued;
        results.push({
          campaign_id: campaign._id,
          campaign_name: campaign.launch_name,
          jobs_enqueued: jobsEnqueued,
          status: 'success',
        });
        console.log(`✓ Campaign ${campaign.launch_name}: ${jobsEnqueued} jobs enqueued`);
      } catch (error) {
        console.error(`✗ Error enqueuing jobs for campaign ${campaign._id}:`, error);
        results.push({
          campaign_id: campaign._id,
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

