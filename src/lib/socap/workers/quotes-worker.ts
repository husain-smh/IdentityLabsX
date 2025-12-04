import { BaseWorker } from './base-worker';
import { Job } from '../job-queue';
import { WorkerState } from '../../models/socap/worker-state';
import { fetchTweetQuotes } from '../../twitter-api-client';
import { createOrUpdateEngagement } from '../../models/socap/engagements';
import { processEngagement } from '../engagement-processor';
import { updateWorkerState } from '../../models/socap/worker-state';
import { getEngagementsByTweet } from '../../models/socap/engagements';
import { updateTweetQuoteViewsFromQuotes, getTweetMetrics } from '../../models/socap/tweets';

/**
 * Quotes Worker
 * Fetches quote tweets and processes them with delta detection
 */
export class QuotesWorker extends BaseWorker {
  protected async processJob(job: Job, state: WorkerState): Promise<void> {
    const tweetId = job.tweet_id;
    const campaignId = job.campaign_id;
    
    // Determine if this is first run (backfill) or subsequent run (delta)
    const isFirstRun = !state.cursor && !state.last_success;
    
    if (isFirstRun) {
      // First run: Backfill all quotes
      await this.backfillQuotes(campaignId, tweetId, state);
    } else {
      // Subsequent run: Delta detection
      await this.processDelta(campaignId, tweetId, state);
    }
  }
  
  /**
   * Backfill all existing quote tweets
   */
  private async backfillQuotes(
    campaignId: string,
    tweetId: string,
    _state: WorkerState
  ): Promise<void> {
    let cursor: string | null = null;
    let allProcessed = 0;
    let totalQuoteViewsFromQuotes = 0;
    
    while (true) {
      const response = await fetchTweetQuotes(tweetId, {
        cursor: cursor || undefined,
        maxPages: 1, // Process one page at a time
      });
      
      // Process each quote
      for (const user of response.data) {
        // Accumulate quote tweet view counts (if present).
        // IMPORTANT: For total views from quote tweets, we count every quote tweet
        // returned by the API, regardless of which tweet it quotes.
        if (typeof user.quoteViewCount === 'number' && !Number.isNaN(user.quoteViewCount)) {
          totalQuoteViewsFromQuotes += user.quoteViewCount;
        }
        
        // Quotes API provides engagement timestamp
        const timestamp = user.engagementCreatedAt || new Date();

        // For engagements, we want to stay STRICT and only treat this as a quote
        // engagement if it actually quotes the target tweet. This keeps SOCAP
        // engagement data clean while still allowing loose aggregation for views.
        if (user.quotedTweetId && user.quotedTweetId !== tweetId) {
          continue;
        }
        
        const engagementInput = await processEngagement(
          campaignId,
          tweetId,
          user,
          'quote',
          timestamp,
          user.engagementText
        );
        
        // For backfill runs, we treat this as the initial baseline for the
        // quote tweet's view count. Store the current quoteViewCount so that
        // subsequent delta runs can compute non-negative per-quote deltas.
        if (typeof user.quoteViewCount === 'number' && !Number.isNaN(user.quoteViewCount)) {
          (engagementInput as any).quote_view_count = user.quoteViewCount;
        }
        
        await createOrUpdateEngagement(engagementInput);
        allProcessed++;
      }
      
      // Update cursor
      cursor = response.nextCursor || null;
      
      // Update state after each page
      await updateWorkerState(campaignId, tweetId, 'quotes', {
        cursor,
      });
      
      // Stop if no more pages
      if (!response.hasMore || !cursor) {
        break;
      }
    }
    
    // After processing all pages, persist the total quote views for this tweet
    if (totalQuoteViewsFromQuotes > 0) {
      await updateTweetQuoteViewsFromQuotes(tweetId, totalQuoteViewsFromQuotes);
    } else {
      // Ensure the field exists even if we saw zero or missing view counts
      await updateTweetQuoteViewsFromQuotes(tweetId, 0);
    }

    // Mark as successful
    await updateWorkerState(campaignId, tweetId, 'quotes', {
      last_success: new Date(),
      cursor,
    });
    
    console.log(`Backfilled ${allProcessed} quotes for tweet ${tweetId}`);
  }
  
  /**
   * Process delta (new quotes only)
   */
  private async processDelta(
    campaignId: string,
    tweetId: string,
    state: WorkerState
  ): Promise<void> {
    // Fetch first page with stored cursor
    const response = await fetchTweetQuotes(tweetId, {
      cursor: state.cursor || undefined,
      maxPages: 1,
    });
    
    // Get existing engagements to check timestamps
    const existingEngagements = await getEngagementsByTweet(tweetId);
    const existingQuotes = existingEngagements.filter((e) => e.action_type === 'quote');
    const existingUserIds = new Set(existingQuotes.map((e) => e.user_id));
    // Map of user_id -> last known quote_view_count (if any)
    const lastViewCountByUserId = new Map<string, number | undefined>();
    for (const engagement of existingQuotes) {
      lastViewCountByUserId.set(engagement.user_id, engagement.quote_view_count);
    }
    const lastSuccessTime = state.last_success || new Date(0);
    
    let newCount = 0;
    let updatedCount = 0;
    let shouldStop = false;
    let deltaQuoteViewsFromQuotes = 0;
    
    // Process quotes (newest first)
    for (const user of response.data) {
      const timestamp = user.engagementCreatedAt || new Date();
      const isNew = !existingUserIds.has(user.userId);
      
      // Stop condition: if we encounter a quote with timestamp older than last_success,
      // all newer items have been processed
      if (!isNew && timestamp < lastSuccessTime) {
        shouldStop = true;
        break;
      }
      
      // Compute per-quote view delta in a way that:
      // - Never double-counts existing views
      // - Never decreases the aggregate total (non-negative deltas)
      // - Seamlessly adopts existing engagements created before this change
      //
      // For *new* quotes:
      //   previous = 0 → delta = current viewCount
      //
      // For *existing* quotes created before this change (no quote_view_count stored):
      //   previous is undefined → we treat delta as 0 and set baseline to current
      //
      // For *existing* quotes with a stored baseline:
      //   delta = max(current - previous, 0)
      let currentViewCount = 0;
      if (typeof user.quoteViewCount === 'number' && !Number.isNaN(user.quoteViewCount)) {
        currentViewCount = user.quoteViewCount;
      }

      let deltaForThisQuote = 0;
      const previousViewCount = lastViewCountByUserId.get(user.userId);

      if (typeof previousViewCount === 'number') {
        const rawDelta = currentViewCount - previousViewCount;
        if (rawDelta > 0) {
          deltaForThisQuote = rawDelta;
        }
      } else if (isNew) {
        // Brand new quote: we haven't counted any of its views yet.
        deltaForThisQuote = currentViewCount;
      } else {
        // Existing quote with no stored baseline (created before this change).
        // Do NOT add currentViewCount again (that would double-count).
        // Instead, treat this as establishing the initial baseline.
        deltaForThisQuote = 0;
      }

      if (deltaForThisQuote > 0) {
        deltaQuoteViewsFromQuotes += deltaForThisQuote;
      }

      // For engagement records, enforce strict matching: only treat this as a quote
      // of the target tweet if quotedTweetId matches. This preserves the original
      // semantics of "who quoted this tweet" even though views are aggregated loosely.
      if (user.quotedTweetId && user.quotedTweetId !== tweetId) {
        continue;
      }

      const engagementInput = await processEngagement(
        campaignId,
        tweetId,
        user,
        'quote',
        timestamp,
        user.engagementText
      );
      
      // Persist the latest per-quote baseline view count so future runs can
      // compute non-negative deltas. This is safe for both new and existing
      // quotes, as we clamp deltas above.
      if (typeof currentViewCount === 'number' && !Number.isNaN(currentViewCount)) {
        (engagementInput as any).quote_view_count = currentViewCount;
      }
      
      await createOrUpdateEngagement(engagementInput);
      
      if (isNew) {
        newCount++;
      } else {
        updatedCount++;
      }
    }
    
    // Update cursor if we got a new one and didn't stop
    if (response.nextCursor && !shouldStop) {
      await updateWorkerState(campaignId, tweetId, 'quotes', {
        cursor: response.nextCursor,
      });
    }
    
    // Update stored quote views metric by adding delta to existing value
    if (deltaQuoteViewsFromQuotes !== 0) {
      // Get current value and add the delta
      const currentMetrics = await getTweetMetrics(tweetId);
      const currentQuoteViews = (currentMetrics as any)?.quoteViewsFromQuotes || 0;
      const newTotal = currentQuoteViews + deltaQuoteViewsFromQuotes;
      await updateTweetQuoteViewsFromQuotes(tweetId, newTotal);
    }

    // Mark as successful
    await updateWorkerState(campaignId, tweetId, 'quotes', {
      last_success: new Date(),
    });
    
    console.log(
      `Delta processed for tweet ${tweetId}: ${newCount} new, ${updatedCount} updated quotes`
    );
  }
}

