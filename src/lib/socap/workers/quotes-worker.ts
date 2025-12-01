import { BaseWorker } from './base-worker';
import { Job } from '../job-queue';
import { WorkerState } from '../../models/socap/worker-state';
import { fetchTweetQuotes } from '../../twitter-api-client';
import { createOrUpdateEngagement } from '../../models/socap/engagements';
import { processEngagement } from '../engagement-processor';
import { updateWorkerState } from '../../models/socap/worker-state';
import { getEngagementsByTweet } from '../../models/socap/engagements';

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
    
    while (true) {
      const response = await fetchTweetQuotes(tweetId, {
        cursor: cursor || undefined,
        maxPages: 1, // Process one page at a time
      });
      
      // Process each quote
      for (const user of response.data) {
        // Quotes API provides engagement timestamp
        const timestamp = user.engagementCreatedAt || new Date();
        
        const engagementInput = await processEngagement(
          campaignId,
          tweetId,
          user,
          'quote',
          timestamp
          // Note: We don't have quote text from FilteredUser, would need to fetch separately
        );
        
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
    const lastSuccessTime = state.last_success || new Date(0);
    
    let newCount = 0;
    let updatedCount = 0;
    let shouldStop = false;
    
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
      
      const engagementInput = await processEngagement(
        campaignId,
        tweetId,
        user,
        'quote',
        timestamp
      );
      
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
      `Delta processed for tweet ${tweetId}: ${newCount} new, ${updatedCount} updated quotes`
    );
  }
}

