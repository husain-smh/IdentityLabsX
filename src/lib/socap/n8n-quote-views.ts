/**
 * N8N Quote Views Integration
 * 
 * Calls the proven N8N webhook to get total views from quote tweets.
 * This uses the same N8N workflow that's already working correctly.
 */

import { getTweetByTweetId } from '../models/socap/tweets';

/**
 * Result from N8N webhook
 */
export interface N8NQuoteViewsResult {
  totalViews: number;
  totalQuotes: number;
  success: boolean;
  statistics?: {
    totalViewsAcrossAllQuoteTweets: number;
    uniqueUsersKept: number;
    totalQuotes?: number;
  };
}

/**
 * Call N8N webhook to get total views from quote tweets
 * 
 * @param tweetId - Tweet ID (will be converted to tweet URL)
 * @returns Total views from all quote tweets
 */
export async function getQuoteViewsFromN8N(tweetId: string): Promise<N8NQuoteViewsResult> {
  // Get tweet to retrieve tweet_url
  const tweet = await getTweetByTweetId(tweetId);
  
  if (!tweet) {
    throw new Error(`Tweet ${tweetId} not found in database`);
  }

  if (!tweet.tweet_url) {
    throw new Error(`Tweet ${tweetId} has no tweet_url stored`);
  }

  const webhookUrl = process.env.N8N_QUOTE_VIEWS_WEBHOOK_URL || 
                     'https://mdhusainil.app.n8n.cloud/webhook/totalQuoteTwtViews';

  console.log(`[N8NQuoteViews] Calling N8N webhook for tweet ${tweetId} (${tweet.tweet_url})`);

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // N8N workflow expects tweetUrl nested under 'body' property
      body: JSON.stringify({ 
        body: { tweetUrl: tweet.tweet_url }
      }),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text().catch(() => 'Unknown error');
      throw new Error(`N8N webhook responded with status ${webhookResponse.status}: ${errorText}`);
    }

    const webhookData = await webhookResponse.json();

    // Extract total views from N8N response
    const totalViews = webhookData.statistics?.totalViewsAcrossAllQuoteTweets || 0;
    const totalQuotes = webhookData.statistics?.uniqueUsersKept || 0; // This is actually unique users, not quote count

    console.log(
      `[N8NQuoteViews] Success: ${totalViews.toLocaleString()} total views from ${totalQuotes} unique quote tweets`
    );

    return {
      totalViews: typeof totalViews === 'number' ? totalViews : parseInt(String(totalViews), 10) || 0,
      totalQuotes: typeof totalQuotes === 'number' ? totalQuotes : parseInt(String(totalQuotes), 10) || 0,
      success: webhookData.success !== false,
      statistics: webhookData.statistics,
    };
  } catch (error) {
    console.error(`[N8NQuoteViews] Error calling N8N webhook for tweet ${tweetId}:`, error);
    throw new Error(
      `Failed to get quote views from N8N: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

