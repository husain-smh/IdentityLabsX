import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringData } from '@/lib/models/monitoring';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tweetId: string }> }
) {
  try {
    const { tweetId } = await params;

    if (!tweetId) {
      return NextResponse.json(
        { error: 'Tweet ID is required' },
        { status: 400 }
      );
    }

    const { job, snapshots } = await getMonitoringData(tweetId);

    if (!job) {
      return NextResponse.json(
        { error: 'Monitoring job not found for this tweet' },
        { status: 404 }
      );
    }

    // Calculate time remaining
    const now = new Date();
    const startedAt = new Date(job.started_at);
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - startedAt.getTime();
    const remaining = Math.max(0, twentyFourHours - elapsed);
    const isActive = job.status === 'active' && remaining > 0;

    return NextResponse.json({
      success: true,
      job: {
        tweet_id: job.tweet_id,
        tweet_url: job.tweet_url,
        status: job.status,
        started_at: job.started_at,
        created_at: job.created_at,
      },
      snapshots: snapshots.map(s => ({
        timestamp: s.timestamp,
        likeCount: s.likeCount,
        retweetCount: s.retweetCount,
        replyCount: s.replyCount,
        quoteCount: s.quoteCount,
        viewCount: s.viewCount,
        bookmarkCount: s.bookmarkCount,
      })),
      stats: {
        total_snapshots: snapshots.length,
        is_active: isActive,
        hours_remaining: Math.floor(remaining / (60 * 60 * 1000)),
        minutes_remaining: Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)),
      },
    });
  } catch (error) {
    console.error('Error fetching monitoring data:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

