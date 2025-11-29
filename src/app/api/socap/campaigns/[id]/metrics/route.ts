import { NextRequest, NextResponse } from 'next/server';
import { getMetricSnapshotsByCampaign } from '@/lib/models/socap/metric-snapshots';

/**
 * GET /socap/campaigns/:id/metrics
 * Get time-series metrics for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const granularity = searchParams.get('granularity') || 'hour';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    const options: {
      startDate?: Date;
      endDate?: Date;
      granularity?: 'hour' | 'day';
    } = {
      granularity: granularity === 'day' ? 'day' : 'hour',
    };
    
    if (startDate) {
      options.startDate = new Date(startDate);
    }
    
    if (endDate) {
      options.endDate = new Date(endDate);
    }
    
    const snapshots = await getMetricSnapshotsByCampaign(id, options);
    
    return NextResponse.json({
      success: true,
      data: {
        snapshots,
        granularity: options.granularity,
      },
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
      },
      { status: 500 }
    );
  }
}

