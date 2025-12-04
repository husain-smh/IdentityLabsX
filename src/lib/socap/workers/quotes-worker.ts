import { BaseWorker } from './base-worker';
import { Job } from '../job-queue';
import { WorkerState } from '../../models/socap/worker-state';
import { fetchTweetQuotes } from '../../twitter-api-client';
import { createOrUpdateEngagement } from '../../models/socap/engagements';
import { processEngagement } from '../engagement-processor';
import { updateWorkerState } from '../../models/socap/worker-state';
import { getEngagementsByTweet } from '../../models/socap/engagements';
import { updateTweetQuoteViewsFromQuotes } from '../../models/socap/tweets';
import { getQuoteViews } from '../n8n-quote-views';

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
   * 
   * Uses N8N webhook to get accurate totals (proven to work correctly),
   * then processes engagements for tracking purposes.
   */
  private async backfillQuotes(
    campaignId: string,
    tweetId: string,
    _state: WorkerState
  ): Promise<void> {
    console.log(`[QuotesWorker] ========== START BACKFILL for tweet ${tweetId} ==========`);
    
    // Step 1: Get total views (uses N8N webhook or extractor based on config)
    try {
      console.log(`[QuotesWorker] BEFORE getQuoteViews for tweet ${tweetId}`);
      const viewsResult = await getQuoteViews(tweetId);
      console.log(`[QuotesWorker] AFTER getQuoteViews - got result:`, viewsResult);
      
      // Step 2: Update the stored total (replace, don't add)
      console.log(`[QuotesWorker] BEFORE updateTweetQuoteViewsFromQuotes`);
      await updateTweetQuoteViewsFromQuotes(tweetId, viewsResult.totalViews);
      console.log(
        `[QuotesWorker] ✅ Updated quoteViewsFromQuotes to ${viewsResult.totalViews.toLocaleString()} ` +
        `(backend: ${viewsResult.backend || 'unknown'})`
      );
    } catch (error) {
      console.error(`[QuotesWorker] ❌ ERROR calculating quote views for tweet ${tweetId}:`, error);
      // Don't throw - continue with engagement processing even if quote views calculation fails
    }

    // Step 3: Process engagements for tracking (fetch all pages again for engagement records)
    let cursor: string | null = null;
    let allProcessed = 0;
    
    while (true) {
      const response = await fetchTweetQuotes(tweetId, {
        cursor: cursor || undefined,
        maxPages: 1, // Process one page at a time
      });
      
      // Process each quote for engagement tracking
      for (const user of response.data) {
        const timestamp = user.engagementCreatedAt || new Date();

        // Only create engagements for quotes that actually quote the target tweet
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
        
        // Store the current quoteViewCount as baseline for future reference
        if (typeof user.quoteViewCount === 'number' && !Number.isNaN(user.quoteViewCount)) {
          (engagementInput as any).quote_view_count = user.quoteViewCount;
        }
        
        await createOrUpdateEngagement(engagementInput);
        allProcessed++;
      }
      
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

    // Mark as successful
    await updateWorkerState(campaignId, tweetId, 'quotes', {
      last_success: new Date(),
      cursor,
    });
    
    console.log(`[QuotesWorker] Backfilled ${allProcessed} quote engagements for tweet ${tweetId}`);
  }
  
  /**
   * Process delta (subsequent runs)
   * 
   * Uses N8N webhook to recompute totals from scratch.
   * This ensures we always have accurate totals, even if quote tweet view counts
   * have changed since the last run. N8N handles all the pagination and logic correctly.
   */
  private async processDelta(
    campaignId: string,
    tweetId: string,
    state: WorkerState
  ): Promise<void> {
    console.log(`[QuotesWorker] ========== START DELTA for tweet ${tweetId} ==========`);
    
    // Step 1: Get total views (uses N8N webhook or extractor based on config)
    // This replaces the old delta logic - we just get fresh totals every time
    try {
      console.log(`[QuotesWorker] BEFORE getQuoteViews for tweet ${tweetId}`);
      const viewsResult = await getQuoteViews(tweetId);
      console.log(`[QuotesWorker] AFTER getQuoteViews - got result:`, viewsResult);
      
      // Step 2: Update the stored total (replace, don't add - this is the key fix)
      console.log(`[QuotesWorker] BEFORE updateTweetQuoteViewsFromQuotes`);
      await updateTweetQuoteViewsFromQuotes(tweetId, viewsResult.totalViews);
      console.log(
        `[QuotesWorker] ✅ Updated quoteViewsFromQuotes to ${viewsResult.totalViews.toLocaleString()} ` +
        `(backend: ${viewsResult.backend || 'unknown'})`
      );
    } catch (error) {
      console.error(`[QuotesWorker] ❌ ERROR calculating quote views for tweet ${tweetId}:`, error);
      // Don't throw - continue with engagement processing even if quote views calculation fails
    }

    // Step 3: Process new/updated engagements for tracking
    const response = await fetchTweetQuotes(tweetId, {
      cursor: state.cursor || undefined,
      maxPages: 1, // Only fetch first page for engagement delta detection
    });
    
    // Get existing engagements to check timestamps
    const existingEngagements = await getEngagementsByTweet(tweetId);
    const existingQuotes = existingEngagements.filter((e) => e.action_type === 'quote');
    const existingUserIds = new Set(existingQuotes.map((e) => e.user_id));
    const lastSuccessTime = state.last_success || new Date(0);
    
    let newCount = 0;
    let updatedCount = 0;
    let shouldStop = false;
    
    // Process quotes (newest first) for engagement tracking
    for (const user of response.data) {
      const timestamp = user.engagementCreatedAt || new Date();
      
      // Only process quotes that actually quote the target tweet
      if (user.quotedTweetId && user.quotedTweetId !== tweetId) {
        continue;
      }
      
      const isNew = !existingUserIds.has(user.userId);
      
      // Stop condition: if we encounter a quote with timestamp older than last_success,
      // all newer items have been processed
      if (!isNew && timestamp < lastSuccessTime) {
        shouldStop = true;
        break;
      }

      const engagementInput = await processEngagement(
        campaignId,
        tweetId,
        user,
        'quote',
        timestamp,
        user.engagementText
      );
      
      // Store the current quoteViewCount as baseline for future reference
      if (typeof user.quoteViewCount === 'number' && !Number.isNaN(user.quoteViewCount)) {
        (engagementInput as any).quote_view_count = user.quoteViewCount;
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

    // Mark as successful
    await updateWorkerState(campaignId, tweetId, 'quotes', {
      last_success: new Date(),
    });
    
    console.log(
      `[QuotesWorker] Delta processed for tweet ${tweetId}: ${newCount} new, ${updatedCount} updated quote engagements`
    );
  }
}

