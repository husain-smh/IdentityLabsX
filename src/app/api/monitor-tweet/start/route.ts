import { NextRequest, NextResponse } from 'next/server';
import { createMonitoringJob, getMonitoringJobByTweetId } from '@/lib/models/monitoring';
import { extractTweetIdFromUrl, fetchTweetMetrics } from '@/lib/external-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweetUrl } = body;

    // Validate tweet URL
    if (!tweetUrl || typeof tweetUrl !== 'string') {
      return NextResponse.json(
        { error: 'Tweet URL is required' },
        { status: 400 }
      );
    }

    // Extract tweet ID from URL
    const tweetId = extractTweetIdFromUrl(tweetUrl);
    if (!tweetId) {
      return NextResponse.json(
        { error: 'Invalid Twitter/X URL. Please provide a valid tweet URL.' },
        { status: 400 }
      );
    }

    // Check if tweet is already being monitored
    const existingJob = await getMonitoringJobByTweetId(tweetId);
    if (existingJob && existingJob.status === 'active') {
      return NextResponse.json(
        {
          success: false,
          error: 'This tweet is already being monitored',
          tweet_id: tweetId,
          job: existingJob,
        },
        { status: 409 }
      );
    }

    // Validate tweet exists by fetching it once
    try {
      await fetchTweetMetrics(tweetId);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch tweet. Please verify the tweet URL is correct.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

    // Create monitoring job
    const job = await createMonitoringJob(tweetId, tweetUrl);

    return NextResponse.json({
      success: true,
      message: 'Monitoring started successfully. Metrics will be collected every 30 minutes for 24 hours.',
      tweet_id: tweetId,
      job: {
        tweet_id: job.tweet_id,
        tweet_url: job.tweet_url,
        status: job.status,
        started_at: job.started_at,
      },
    });
  } catch (error) {
    console.error('Error starting tweet monitoring:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to start monitoring',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

