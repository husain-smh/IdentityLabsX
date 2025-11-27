/**
 * Tweet Analysis Orchestrator - Main orchestration logic
 */

import { fetchTweetMetrics } from './external-api';
import { fetchTweetReplies, fetchTweetRetweets, fetchTweetQuotes } from './twitter-api-client';
import { processAllEngagements } from './user-processor';
import {
  getTweet,
  getTweetMetrics,
  updateTweetMetrics,
  compareMetrics,
  createTweet,
  storeEngagers,
  updateTweetStatus,
  updateTweetAuthorInfo,
  type TweetMetrics,
  type MetricsComparison,
} from './models/tweets';
import { rankEngagers } from './models/ranker';
import { updateEngagersWithRanking } from './models/tweets';
import { logger } from './logger';
import { metricsTracker } from './metrics-tracker';
import { ProcessingError } from './errors/analysis-errors';

export interface FetchStrategy {
  fetchReplies: boolean;
  fetchRetweets: boolean;
  fetchQuotes: boolean;
}

export interface AnalysisResult {
  success: boolean;
  tweetId: string;
  totalEngagers: number;
  metrics: TweetMetrics;
  comparison: MetricsComparison;
  error?: string;
}

/**
 * Determine which endpoints to fetch based on metric changes
 */
export function determineFetchStrategy(comparison: MetricsComparison): FetchStrategy {
  return {
    fetchReplies: comparison.changedFields.replies,
    fetchRetweets: comparison.changedFields.retweets,
    fetchQuotes: comparison.changedFields.quotes,
  };
}

/**
 * Check if metrics changed significantly enough to warrant re-analysis
 */
export function shouldReanalyze(comparison: MetricsComparison): boolean {
  // Re-analyze if any metric changed
  return comparison.hasChanges;
}

/**
 * Main analysis function
 */
export async function analyzeTweet(
  tweetId: string,
  tweetUrl: string,
  options: {
    reanalyze?: boolean;
    authorName?: string;
    authorUsername?: string;
  } = {}
): Promise<AnalysisResult> {
  const metricId = metricsTracker.start('analyze_tweet', { tweetId });
  logger.info('Starting tweet analysis', { tweetId, operation: 'analyzeTweet' });

  try {
    // Step 1: Fetch current metrics
    logger.info('Fetching current tweet metrics', { tweetId });
    const currentMetrics = await fetchTweetMetrics(tweetId);
    
    const metricsWithTimestamp: TweetMetrics = {
      ...currentMetrics,
      last_updated: new Date(),
    };

    // Step 2: Get existing tweet or create new
    let existingTweet = await getTweet(tweetId);
    const oldMetrics = existingTweet?.metrics || null;

    if (!existingTweet) {
      // Create new tweet entry
      const authorName = options.authorName || 'Unknown';
      existingTweet = await createTweet(tweetId, tweetUrl, authorName, options.authorUsername);
      logger.info('Created new tweet entry', { tweetId });
    } else if (options.authorName) {
      await updateTweetAuthorInfo(tweetId, options.authorName, options.authorUsername);
    }

    // Step 3: Compare metrics
    const comparison = compareMetrics(oldMetrics, metricsWithTimestamp);
    logger.info('Metrics comparison', { tweetId, comparison });

    // Step 4: Check if re-analysis is needed
    if (!options.reanalyze && !shouldReanalyze(comparison)) {
      logger.info('No metric changes detected, skipping re-analysis', { tweetId });
      metricsTracker.end(metricId, true);
      return {
        success: true,
        tweetId,
        totalEngagers: existingTweet.total_engagers,
        metrics: metricsWithTimestamp,
        comparison,
      };
    }

    // Step 5: Update metrics in database
    await updateTweetMetrics(tweetId, currentMetrics);
    logger.info('Updated tweet metrics', { tweetId });

    // Step 6: Determine fetch strategy
    const strategy = options.reanalyze
      ? { fetchReplies: true, fetchRetweets: true, fetchQuotes: true }
      : determineFetchStrategy(comparison);
    logger.info('Fetch strategy determined', { tweetId, strategy });

    // Step 7: Fetch engagement data in parallel (only what changed)
    logger.info('Fetching engagement data', { tweetId, strategy });
    const fetchPromises: Promise<any>[] = [];

    if (strategy.fetchReplies) {
      fetchPromises.push(
        fetchTweetReplies(tweetId).catch(err => {
          logger.error('Failed to fetch replies', err, { tweetId });
          return { data: [] };
        })
      );
    } else {
      fetchPromises.push(Promise.resolve({ data: [] }));
    }

    if (strategy.fetchRetweets) {
      fetchPromises.push(
        fetchTweetRetweets(tweetId).catch(err => {
          logger.error('Failed to fetch retweets', err, { tweetId });
          return { data: [] };
        })
      );
    } else {
      fetchPromises.push(Promise.resolve({ data: [] }));
    }

    if (strategy.fetchQuotes) {
      fetchPromises.push(
        fetchTweetQuotes(tweetId).catch(err => {
          logger.error('Failed to fetch quotes', err, { tweetId });
          return { data: [] };
        })
      );
    } else {
      fetchPromises.push(Promise.resolve({ data: [] }));
    }

    const [repliesResult, retweetsResult, quotesResult] = await Promise.all(fetchPromises);

    logger.info('Fetched engagement data', {
      tweetId,
      replies: repliesResult.data?.length || 0,
      retweets: retweetsResult.data?.length || 0,
      quotes: quotesResult.data?.length || 0,
    });

    // Step 8: Process and merge all engagements
    const engagers = processAllEngagements(
      repliesResult.data || [],
      retweetsResult.data || [],
      quotesResult.data || []
    );

    logger.info('Processed engagers', { tweetId, totalEngagers: engagers.length });

    // Step 9: Store engagers in database
    if (existingTweet.total_engagers > 0) {
      // Re-analysis: delete old engagers first
      const { deleteEngagersByTweetId } = await import('./models/tweets');
      await deleteEngagersByTweetId(tweetId);
      logger.info('Deleted old engagers for re-analysis', { tweetId });
    }

    await storeEngagers(tweetId, engagers);
    logger.info('Stored engagers in database', { tweetId, count: engagers.length });

    // Step 10: Trigger background ranking (fire and forget)
    rankEngagersInBackground(tweetId, engagers).catch(error => {
      logger.error('Background ranking failed', error, { tweetId });
    });

    metricsTracker.end(metricId, true);

    return {
      success: true,
      tweetId,
      totalEngagers: engagers.length,
      metrics: metricsWithTimestamp,
      comparison,
    };
  } catch (error) {
    logger.error('Tweet analysis failed', error, { tweetId });
    metricsTracker.end(metricId, false, error instanceof Error ? error.message : 'Unknown error');

    // Update tweet status to failed
    await updateTweetStatus(
      tweetId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    ).catch(() => {
      // Ignore errors updating status
    });

    throw new ProcessingError(
      tweetId,
      'analyzeTweet',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Background job to rank engagers
 */
async function rankEngagersInBackground(
  tweetId: string,
  engagers: any[]
): Promise<void> {
  const rankId = metricsTracker.start('rank_engagers', { tweetId });
  logger.info('Starting background ranking', { tweetId });

  try {
    const rankedEngagers = await rankEngagers(engagers);

    const rankingData = rankedEngagers.map(re => ({
      userId: re.userId,
      importance_score: re.importance_score,
      followed_by: re.followed_by.map((p: any) => p.username),
    }));

    await updateEngagersWithRanking(tweetId, rankingData);
    await updateTweetStatus(tweetId, 'completed');

    logger.info('Background ranking completed', { tweetId });
    metricsTracker.end(rankId, true);
  } catch (error) {
    logger.error('Background ranking failed', error, { tweetId });
    await updateTweetStatus(
      tweetId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
    metricsTracker.end(rankId, false, error instanceof Error ? error.message : 'Unknown error');
  }
}

