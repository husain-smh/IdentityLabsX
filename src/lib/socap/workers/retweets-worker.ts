import { BaseWorker } from './base-worker';
import { Job } from '../job-queue';
import { WorkerState } from '../../models/socap/worker-state';
import { fetchTweetRetweets } from '../../twitter-api-client';
import { createOrUpdateEngagement } from '../../models/socap/engagements';
import { processEngagement } from '../engagement-processor';
import { updateWorkerState } from '../../models/socap/worker-state';
import { getEngagementsByTweet } from '../../models/socap/engagements';

/**
 * Retweets Worker
 * Fetches retweeters and processes them with delta detection
 */
export class RetweetsWorker extends BaseWorker {
  protected async processJob(job: Job, state: WorkerState): Promise<void> {
    const tweetId = job.tweet_id;
    const campaignId = job.campaign_id;
    
    // Determine if this is first run (backfill) or subsequent run (delta)
    const isFirstRun = !state.cursor && !state.last_success;
    
    if (isFirstRun) {
      // First run: Backfill all retweeters
      await this.backfillRetweeters(campaignId, tweetId, state);
    } else {
      // Subsequent run: Delta detection
      await this.processDelta(campaignId, tweetId, state);
    }
  }
  
  /**
   * Backfill all existing retweeters
   */
  private async backfillRetweeters(
    campaignId: string,
    tweetId: string,
    state: WorkerState
  ): Promise<void> {
    let cursor: string | null = null;
    let allProcessed = 0;
    
    while (true) {
      const response = await fetchTweetRetweets(tweetId, {
        cursor: cursor || undefined,
        maxPages: 1, // Process one page at a time
      });
      
      // Process each retweeter
      for (const user of response.data) {
        // For retweets, we don't have engagement timestamp from API
        // Use current time as approximation (API returns newest first)
        const timestamp = new Date();
        
        const engagementInput = await processEngagement(
          campaignId,
          tweetId,
          user,
          'retweet',
          timestamp
        );
        
        await createOrUpdateEngagement(engagementInput);
        allProcessed++;
      }
      
      // Update cursor
      cursor = response.nextCursor || null;
      
      // Update state after each page
      await updateWorkerState(campaignId, tweetId, 'retweets', {
        cursor,
      });
      
      // Stop if no more pages
      if (!response.hasMore || !cursor) {
        break;
      }
    }
    
    // Mark as successful
    await updateWorkerState(campaignId, tweetId, 'retweets', {
      last_success: new Date(),
      cursor,
    });
    
    console.log(`Backfilled ${allProcessed} retweeters for tweet ${tweetId}`);
  }
  
  /**
   * Process delta (new retweeters only)
   */
  private async processDelta(
    campaignId: string,
    tweetId: string,
    state: WorkerState
  ): Promise<void> {
    // Fetch first page with stored cursor
    const response = await fetchTweetRetweets(tweetId, {
      cursor: state.cursor || undefined,
      maxPages: 1,
    });
    
    // Get existing engagements to check for duplicates
    const existingEngagements = await getEngagementsByTweet(tweetId);
    const existingUserIds = new Set(
      existingEngagements
        .filter((e) => e.action_type === 'retweet')
        .map((e) => e.user_id)
    );
    
    let newCount = 0;
    let updatedCount = 0;
    
    // Process retweeters (newest first)
    for (const user of response.data) {
      const isNew = !existingUserIds.has(user.userId);
      
      const timestamp = new Date(); // Approximate timestamp
      
      const engagementInput = await processEngagement(
        campaignId,
        tweetId,
        user,
        'retweet',
        timestamp
      );
      
      await createOrUpdateEngagement(engagementInput);
      
      if (isNew) {
        newCount++;
      } else {
        updatedCount++;
      }
      
      // Stop if we've seen this user before (all newer items processed)
      // Note: For retweets, we can't use timestamp comparison since API doesn't provide it
      // So we process the first page and stop
      if (!isNew && existingUserIds.size > 0) {
        // We've hit existing users, likely all new ones are processed
        break;
      }
    }
    
    // Update cursor if we got a new one
    if (response.nextCursor) {
      await updateWorkerState(campaignId, tweetId, 'retweets', {
        cursor: response.nextCursor,
      });
    }
    
    // Mark as successful
    await updateWorkerState(campaignId, tweetId, 'retweets', {
      last_success: new Date(),
    });
    
    console.log(
      `Delta processed for tweet ${tweetId}: ${newCount} new, ${updatedCount} updated retweeters`
    );
  }
}

