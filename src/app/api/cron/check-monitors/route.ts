import { NextResponse } from 'next/server';
import { getActiveMonitoringJobs, completeMonitoringJob, storeMetricSnapshot } from '@/lib/models/monitoring';
import { fetchTweetMetrics, fetchQuoteMetricsAggregate } from '@/lib/external-api';

export async function GET() {
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
        // Check if monitoring period (72 hours) has passed
        const startedAt = new Date(job.started_at);
        const monitorDurationMs = 72 * 60 * 60 * 1000;
        const endTime = new Date(startedAt.getTime() + monitorDurationMs);
        const shouldComplete = now >= endTime;

        if (shouldComplete) {
          // Mark as completed if 72 hours have passed
          await completeMonitoringJob(job.tweet_id);
          completed++;
          continue;
        }

        // Fetch current metrics from external API
        const metrics = await fetchTweetMetrics(job.tweet_id);

        // Fetch quote aggregates (with pagination) and tolerate failures
        let quoteAgg = { quoteTweetCount: 0, quoteViewSum: 0 };
        try {
          quoteAgg = await fetchQuoteMetricsAggregate(job.tweet_id);
        } catch (quoteError) {
          const msg = quoteError instanceof Error ? quoteError.message : 'Unknown quote fetch error';
          console.error(`Quote fetch error for ${job.tweet_id}:`, quoteError);
          errors.push(`Quote fetch error for ${job.tweet_id}: ${msg}`);
        }

        // Store snapshot with quote aggregates
        await storeMetricSnapshot(job.tweet_id, {
          ...metrics,
          // Fallback: if quotes API returns none, use tweet's own quoteCount as the count
          quoteTweetCount: quoteAgg.quoteTweetCount || metrics.quoteCount,
          quoteViewSum: quoteAgg.quoteViewSum,
        });

        processed++;

        // Check again after storing (in case it took time)
        const checkAgain = new Date();
        const endTimeAfter = new Date(startedAt.getTime() + monitorDurationMs);
        if (checkAgain >= endTimeAfter) {
          await completeMonitoringJob(job.tweet_id);
          completed++;
        }
      } catch (error) {
        // Categorize errors for better logging
        let errorMessage: string;
        let errorType: string = 'unknown';
        
        if (error instanceof Error) {
          if (error.name === 'TwitterApiError') {
            errorType = 'api_error';
            errorMessage = `Twitter API error for tweet ${job.tweet_id}: ${error.message}`;
          } else if (error.message.includes('rate limit')) {
            errorType = 'rate_limit';
            errorMessage = `Rate limit hit for tweet ${job.tweet_id}. Will retry on next run.`;
          } else if (error.message.includes('not found') || error.message.includes('deleted')) {
            errorType = 'tweet_not_found';
            errorMessage = `Tweet ${job.tweet_id} not found. It may have been deleted.`;
            // Optionally mark job as completed if tweet is deleted
            // await completeMonitoringJob(job.tweet_id);
          } else {
            errorType = 'network_error';
            errorMessage = `Network/connection error for tweet ${job.tweet_id}: ${error.message}`;
          }
        } else {
          errorMessage = `Unknown error processing tweet ${job.tweet_id}`;
        }
        
        console.error(`[${errorType.toUpperCase()}] ${errorMessage}`, error);
        errors.push(errorMessage);
        
        // Continue processing other jobs even if one fails
        // This ensures one bad tweet doesn't stop monitoring for others
      }
    }

    // Always return 200 OK even if there are errors
    // This prevents N8N from marking the workflow as failed
    // Errors are logged and included in response for monitoring
    return NextResponse.json({
      success: true,
      processed,
      completed,
      total_active: activeJobs.length,
      errors: errors.length > 0 ? errors : undefined,
      error_count: errors.length,
      timestamp: now.toISOString(),
      message: errors.length > 0 
        ? `Processed ${processed} tweets, ${errors.length} errors occurred`
        : `Successfully processed ${processed} tweets`,
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

