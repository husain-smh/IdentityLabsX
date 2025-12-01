import { NextRequest, NextResponse } from 'next/server';
import { getAlertQueueCollection } from '@/lib/models/socap/alert-queue';

/**
 * POST /api/socap/campaigns/[id]/alerts/dedupe
 *
 * One-time maintenance endpoint to deduplicate alerts for a campaign.
 * - Ensures only ONE alert exists per (campaign_id, engagement_id)
 * - Keeps the most recent alert (by created_at) and deletes older duplicates.
 *
 * Safe to run multiple times; after the first run, there should be no duplicates.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await context.params;

    const collection = await getAlertQueueCollection();

    // Load all alerts for this campaign
    const alerts = await collection
      .find({ campaign_id: campaignId })
      .sort({ created_at: 1 })
      .toArray();

    if (alerts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No alerts found for this campaign',
        data: { campaign_id: campaignId, alerts_total: 0, deleted: 0, kept: 0 },
      });
    }

    // Group by engagement_id and decide which _id to keep vs delete
    const keepIds = new Set<string>();
    const deleteIds: string[] = [];

    const byEngagement = new Map<string, Array<typeof alerts[number]>>();
    for (const alert of alerts) {
      // Normalize engagement_id to string so ObjectId vs string
      // representations are grouped together
      const key = String(alert.engagement_id);
      if (!byEngagement.has(key)) {
        byEngagement.set(key, []);
      }
      byEngagement.get(key)!.push(alert);
    }

    for (const [, group] of byEngagement.entries()) {
      // Keep the latest one (by created_at); others go to delete
      const sorted = group.sort((a, b) => {
        const aTime = (a.created_at instanceof Date ? a.created_at : new Date(a.created_at)).getTime();
        const bTime = (b.created_at instanceof Date ? b.created_at : new Date(b.created_at)).getTime();
        return aTime - bTime;
      });

      const toKeep = sorted[sorted.length - 1];
      if (toKeep._id) {
        keepIds.add(String(toKeep._id));
      }

      for (const candidate of sorted.slice(0, -1)) {
        if (candidate._id) {
          const idStr = String(candidate._id);
          if (!keepIds.has(idStr)) {
            deleteIds.push(idStr);
          }
        }
      }
    }

    let deletedCount = 0;
    if (deleteIds.length > 0) {
      const { ObjectId } = await import('mongodb');
      const objectIds = deleteIds.map((id) => new ObjectId(id));
      const result = await collection.deleteMany({
        _id: { $in: objectIds as any },
      });
      deletedCount = result.deletedCount ?? 0;
    }

    return NextResponse.json({
      success: true,
      message: 'Alert deduplication completed',
      data: {
        campaign_id: campaignId,
        alerts_total: alerts.length,
        unique_engagements: byEngagement.size,
        kept: keepIds.size,
        deleted: deletedCount,
      },
    });
  } catch (error) {
    console.error('Error deduplicating alerts for campaign:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to deduplicate alerts for campaign',
      },
      { status: 500 }
    );
  }
}


