import { NextResponse } from 'next/server';
import { getActiveMonitoringJobs, completeMonitoringJob, storeMetricSnapshot, getLastValidQuoteViewSum } from '@/lib/models/monitoring';
import { fetchTweetMetrics, fetchQuoteMetricsAggregate, QuoteAggregateResult } from '@/lib/external-api';

export async function GET() {
  const cronStart = Date.now();
  
  try {
    // Optional: Add basic auth check here if needed
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_AUTH_TOKEN}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const now = new Date();
    const activeJobs = await getActiveMonitoringJobs();
    
    console.log(`[cron-monitors] 🚀 Starting cron run at ${now.toISOString()}, ${activeJobs.length} active jobs`);
    
    let processed = 0;
    let completed = 0;
    let usedFallback = 0;
    const errors: string[] = [];
    const jobDetails: Array<{ tweetId: string; status: string; quoteViewSum: number; source: string }> = [];

    // Process each active job
    for (const job of activeJobs) {
      const jobStart = Date.now();
      console.log(`[cron-monitors] Processing job: tweetId=${job.tweet_id}`);
      
      try {
        // Check if monitoring period (5 days) has passed
        const startedAt = new Date(job.started_at);
        const monitorDurationMs = 5 * 24 * 60 * 60 * 1000; // 5 days
        const endTime = new Date(startedAt.getTime() + monitorDurationMs);
        const shouldComplete = now >= endTime;

        if (shouldComplete) {
          // Mark as completed if 5 days have passed
          await completeMonitoringJob(job.tweet_id);
          completed++;
          console.log(`[cron-monitors] ✅ Job completed (expired): tweetId=${job.tweet_id}`);
          jobDetails.push({ tweetId: job.tweet_id, status: 'completed', quoteViewSum: 0, source: 'expired' });
          continue;
        }

        // Fetch current metrics from external API
        // Use dedicated 'monitor' API key to protect from batch operation rate limits
        const metrics = await fetchTweetMetrics(job.tweet_id, 1, 'monitor');
        console.log(`[cron-monitors] Fetched base metrics for ${job.tweet_id}: quoteCount=${metrics.quoteCount}, viewCount=${metrics.viewCount}`);

        // Fetch quote aggregates (with pagination) - now with improved logic
        let quoteAgg: QuoteAggregateResult | null = null;
        let finalQuoteViewSum = 0;
        let finalQuoteTweetCount = 0;
        let dataSource = 'fresh';

        try {
          // Pass expected quote count for dynamic page cap
          // Use dedicated 'monitor' API key to protect from batch operation rate limits
          quoteAgg = await fetchQuoteMetricsAggregate(job.tweet_id, {
            expectedQuoteCount: metrics.quoteCount,
            keyType: 'monitor',
          });

          // Validate the result - don't trust 0 if we expected data
          const isDataTrustworthy = 
            quoteAgg.quoteViewSum > 0 || 
            metrics.quoteCount === 0 ||
            (quoteAgg.meta.coveragePercent !== undefined && quoteAgg.meta.coveragePercent >= 50);

          if (isDataTrustworthy) {
            finalQuoteViewSum = quoteAgg.quoteViewSum;
            finalQuoteTweetCount = quoteAgg.quoteTweetCount || metrics.quoteCount;
            dataSource = 'fresh';
            
            // Log any quality issues
            if (quoteAgg.meta.errors.length > 0) {
              console.warn(`[cron-monitors] ⚠️ Quote fetch had issues for ${job.tweet_id}: ${quoteAgg.meta.errors.join('; ')}`);
            }
          } else {
            // Data looks suspicious (0 when we expected something) - use fallback
            console.warn(
              `[cron-monitors] ⚠️ Suspicious data for ${job.tweet_id}: ` +
              `quoteViewSum=${quoteAgg.quoteViewSum}, expected ~${metrics.quoteCount} quotes, ` +
              `coverage=${quoteAgg.meta.coveragePercent}%. Checking for fallback...`
            );
            
            const lastValid = await getLastValidQuoteViewSum(job.tweet_id);
            if (lastValid) {
              finalQuoteViewSum = lastValid.quoteViewSum;
              finalQuoteTweetCount = lastValid.quoteTweetCount;
              dataSource = 'fallback';
              usedFallback++;
              console.log(
                `[cron-monitors] 📦 Using fallback for ${job.tweet_id}: ` +
                `quoteViewSum=${lastValid.quoteViewSum} from ${lastValid.timestamp.toISOString()}`
              );
            } else {
              // No fallback available, use what we got (even if 0)
              finalQuoteViewSum = quoteAgg.quoteViewSum;
              finalQuoteTweetCount = quoteAgg.quoteTweetCount || metrics.quoteCount;
              dataSource = 'fresh_no_fallback';
              console.warn(`[cron-monitors] ⚠️ No fallback available for ${job.tweet_id}, using fresh data (${finalQuoteViewSum})`);
            }
          }
        } catch (quoteError) {
          const msg = quoteError instanceof Error ? quoteError.message : 'Unknown quote fetch error';
          console.error(`[cron-monitors] ❌ Quote fetch failed for ${job.tweet_id}: ${msg}`);
          errors.push(`Quote fetch error for ${job.tweet_id}: ${msg}`);
          
          // On complete failure, try to use last known good value
          const lastValid = await getLastValidQuoteViewSum(job.tweet_id);
          if (lastValid) {
            finalQuoteViewSum = lastValid.quoteViewSum;
            finalQuoteTweetCount = lastValid.quoteTweetCount;
            dataSource = 'fallback_on_error';
            usedFallback++;
            console.log(
              `[cron-monitors] 📦 Using fallback after error for ${job.tweet_id}: ` +
              `quoteViewSum=${lastValid.quoteViewSum} from ${lastValid.timestamp.toISOString()}`
            );
          } else {
            // No fallback, skip storing this metric to avoid polluting data with 0
            console.warn(`[cron-monitors] ⚠️ No fallback for ${job.tweet_id}, SKIPPING snapshot to avoid 0 value`);
            dataSource = 'skipped';
            jobDetails.push({ tweetId: job.tweet_id, status: 'skipped', quoteViewSum: 0, source: 'no_data' });
            continue; // Skip this job, don't store bad data
          }
        }

        // Store snapshot with quote aggregates
        await storeMetricSnapshot(job.tweet_id, {
          ...metrics,
          quoteTweetCount: finalQuoteTweetCount,
          quoteViewSum: finalQuoteViewSum,
        });

        const jobElapsed = Date.now() - jobStart;
        processed++;
        
        console.log(
          `[cron-monitors] ✅ Stored snapshot for ${job.tweet_id}: ` +
          `quoteViewSum=${finalQuoteViewSum.toLocaleString()}, quoteTweetCount=${finalQuoteTweetCount}, ` +
          `source=${dataSource}, elapsed=${jobElapsed}ms`
        );
        
        jobDetails.push({ 
          tweetId: job.tweet_id, 
          status: 'processed', 
          quoteViewSum: finalQuoteViewSum, 
          source: dataSource 
        });

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
        
        console.error(`[cron-monitors] ❌ [${errorType.toUpperCase()}] ${errorMessage}`, error);
        errors.push(errorMessage);
        jobDetails.push({ tweetId: job.tweet_id, status: 'error', quoteViewSum: 0, source: errorType });
        
        // Continue processing other jobs even if one fails
        // This ensures one bad tweet doesn't stop monitoring for others
      }
    }

    const totalElapsed = Date.now() - cronStart;
    
    console.log(
      `[cron-monitors] 🏁 Cron run complete: ` +
      `processed=${processed}, completed=${completed}, usedFallback=${usedFallback}, ` +
      `errors=${errors.length}, elapsed=${totalElapsed}ms`
    );

    // Always return 200 OK even if there are errors
    // This prevents N8N from marking the workflow as failed
    // Errors are logged and included in response for monitoring
    return NextResponse.json({
      success: true,
      processed,
      completed,
      usedFallback,
      total_active: activeJobs.length,
      errors: errors.length > 0 ? errors : undefined,
      error_count: errors.length,
      elapsed_ms: totalElapsed,
      timestamp: now.toISOString(),
      job_details: jobDetails,
      message: errors.length > 0 
        ? `Processed ${processed} tweets, ${errors.length} errors occurred, ${usedFallback} used fallback`
        : `Successfully processed ${processed} tweets (${usedFallback} used fallback)`,
    });
  } catch (error) {
    console.error('[cron-monitors] ❌ Fatal error in cron job:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to check monitors',
        details: error instanceof Error ? error.message : 'Unknown error',
        elapsed_ms: Date.now() - cronStart,
      },
      { status: 500 }
    );
  }
}

