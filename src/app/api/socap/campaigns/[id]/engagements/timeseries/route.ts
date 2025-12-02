import { NextRequest, NextResponse } from 'next/server';
import { getEngagementTimeSeriesByCampaign } from '@/lib/models/socap/engagements';

/**
 * GET /socap/campaigns/:id/engagements/timeseries
 * Time-bucketed engagement metrics for a campaign.
 *
 * Query params:
 * - granularity: 'hour' | 'day' (default: 'hour')
 * - start_date: ISO string (optional)
 * - end_date: ISO string (optional)
 * - action_type: 'retweet' | 'reply' | 'quote' (optional, filters events)
 * - category: 'main_twt' | 'influencer_twt' | 'investor_twt' (optional)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const granularityParam = searchParams.get('granularity');
    const granularity = granularityParam === 'day' ? 'day' : 'hour';

    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const actionType = searchParams.get('action_type') as
      | 'retweet'
      | 'reply'
      | 'quote'
      | null;

    const category = searchParams.get('category') as
      | 'main_twt'
      | 'influencer_twt'
      | 'investor_twt'
      | null;

    const series = await getEngagementTimeSeriesByCampaign(id, {
      startDate,
      endDate,
      granularity,
      action_type: actionType || undefined,
      category: category || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        granularity,
        points: series.map((p) => ({
          time: p.bucket_start,
          retweets: p.retweets,
          replies: p.replies,
          quotes: p.quotes,
          total: p.total,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching engagement time series:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch engagement time series',
      },
      { status: 500 }
    );
  }
}


