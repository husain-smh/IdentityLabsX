/**
 * External API integration for fetching tweet metrics
 * API: https://api.twitterapi.io/twitter/tweets
 */

export interface TweetMetrics {
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  bookmarkCount: number;
}

export interface TwitterApiResponse {
  tweets: Array<{
    id: string;
    likeCount: number;
    retweetCount: number;
    replyCount: number;
    quoteCount: number;
    viewCount: number;
    bookmarkCount: number;
  }>;
  status: 'success' | 'error';
  message?: string;
}

/**
 * Fetch tweet metrics from external API
 */
export async function fetchTweetMetrics(tweetId: string): Promise<TweetMetrics> {
  const apiKey = process.env.TWITTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('TWITTER_API_KEY environment variable is not set');
  }
  
  const apiUrl = process.env.TWITTER_API_URL || 'https://api.twitterapi.io';
  const url = `${apiUrl}/twitter/tweets?tweet_ids=${tweetId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Twitter API responded with status: ${response.status}`);
    }
    
    const data: TwitterApiResponse = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || 'Twitter API returned an error');
    }
    
    if (!data.tweets || data.tweets.length === 0) {
      throw new Error(`No tweet found with ID: ${tweetId}`);
    }
    
    const tweet = data.tweets[0];
    
    return {
      likeCount: tweet.likeCount || 0,
      retweetCount: tweet.retweetCount || 0,
      replyCount: tweet.replyCount || 0,
      quoteCount: tweet.quoteCount || 0,
      viewCount: tweet.viewCount || 0,
      bookmarkCount: tweet.bookmarkCount || 0,
    };
  } catch (error) {
    console.error('Error fetching tweet metrics:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Failed to fetch tweet metrics from external API');
  }
}

/**
 * Extract tweet ID from Twitter/X URL
 */
export function extractTweetIdFromUrl(tweetUrl: string): string | null {
  // Match patterns like:
  // https://twitter.com/username/status/1234567890
  // https://x.com/username/status/1234567890
  // https://www.twitter.com/username/status/1234567890
  const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
  
  if (!match || !match[1]) {
    return null;
  }
  
  return match[1];
}

