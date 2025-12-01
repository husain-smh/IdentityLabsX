import { NextRequest, NextResponse } from 'next/server';
import { getAlertsByCampaign } from '@/lib/models/socap/alert-queue';
import { getEngagementById } from '@/lib/models/socap/engagements';
import { getAlertHistoryByCampaign } from '@/lib/models/socap/alert-history';

/**
 * GET /api/socap/campaigns/[id]/alerts
 *
 * Returns queued alerts and recent alert history for a campaign.
 * This is used purely for visualization/debugging of alert formation,
 * spacing, and timing in the SOCAP UI.
 *
 * Note: In Next.js 15 route handlers, `params` is async and must be awaited.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await context.params;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'sent' | 'skipped' | null;

    // Fetch alerts for this campaign (default: all statuses, up to 200 for UI)
    const alerts = await getAlertsByCampaign(campaignId, {
      status: status ?? undefined,
      limit: 200,
    });

    // Attach engagement details to each alert so the UI can render
    const alertWithDetails = await Promise.all(
      alerts.map(async (alert) => {
        const engagement = await getEngagementById(alert.engagement_id);
        return {
          ...alert,
          engagement,
        };
      })
    );

    // Also fetch recent alert history so we can see what actually went out
    const history = await getAlertHistoryByCampaign(campaignId, 100);

    return NextResponse.json({
      success: true,
      data: {
        alerts: alertWithDetails,
        history,
      },
    });
  } catch (error) {
    console.error('Error fetching SOCAP alerts for campaign:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alerts for campaign',
      },
      { status: 500 }
    );
  }
}


