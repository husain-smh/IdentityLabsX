import { NextRequest, NextResponse } from 'next/server';
import { getActiveMonitoringJobs, completeMonitoringJob, storeMetricSnapshot } from '@/lib/models/monitoring';
import { fetchTweetMetrics } from '@/lib/external-api';

export async function GET(request: NextRequest) {
  try {
    // Optional: Add basic auth check here if needed
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_AUTH_TOKEN}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const now = new Date();
    const activeJobs = await getActiveMonitoringJobs();
    
    let processed = 0;
    let completed = 0;
    const errors: string[] = [];

    // Process each active job
    for (const job of activeJobs) {
      try {
        // Check if monitoring period (24 hours) has passed
        const startedAt = new Date(job.started_at);
        const endTime = new Date(startedAt.getTime() + 24 * 60 * 60 * 1000);
        const shouldComplete = now >= endTime;

        if (shouldComplete) {
          // Mark as completed if 24 hours have passed
          await completeMonitoringJob(job.tweet_id);
          completed++;
          continue;
        }

        // Fetch current metrics from external API
        const metrics = await fetchTweetMetrics(job.tweet_id);

        // Store snapshot
        await storeMetricSnapshot(job.tweet_id, metrics);

        processed++;

        // Check again after storing (in case it took time)
        const checkAgain = new Date();
        const endTimeAfter = new Date(startedAt.getTime() + 24 * 60 * 60 * 1000);
        if (checkAgain >= endTimeAfter) {
          await completeMonitoringJob(job.tweet_id);
          completed++;
        }
      } catch (error) {
        const errorMessage = `Error processing tweet ${job.tweet_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage, error);
        errors.push(errorMessage);
        // Continue processing other jobs even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      completed,
      total_active: activeJobs.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error in check-monitors cron job:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to check monitors',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

