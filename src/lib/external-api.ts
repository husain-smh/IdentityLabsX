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
  last_updated?: Date;
}

export interface TweetQuote {
  id: string;
  viewCount?: number;
  quoteCount?: number;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  bookmarkCount?: number;
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
    author?: {
      id: string;
      name: string;
      userName?: string;
      screen_name?: string;
    };
  }>;
  status: 'success' | 'error';
  message?: string;
}

export interface TwitterQuotesResponse extends TwitterApiResponse {
  has_next_page?: boolean;
  next_cursor?: string;
}

export interface TweetDetails {
  id: string;
  authorName: string;
  authorUsername?: string;
  text?: string;
  metrics: TweetMetrics;
}

/**
 * Custom error classes for better error handling
 */
export class TwitterApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRetryable: boolean = false,
    public errorCode?: string,
    public context?: {
      tweetId?: string;
      operation?: string;
      retryAfter?: number;
    }
  ) {
    super(message);
    this.name = 'TwitterApiError';
  }
}

/**
 * Fetch tweet metrics from external API with retry logic
 */
export async function fetchTweetMetrics(
  tweetId: string,
  retries: number = 1
): Promise<TweetMetrics> {
  const apiKey = process.env.TWITTER_API_KEY;
  
  if (!apiKey) {
    throw new TwitterApiError('TWITTER_API_KEY environment variable is not set', 500, false);
  }
  
  const apiUrl = process.env.TWITTER_API_URL || 'https://api.twitterapi.io';
  const url = `${apiUrl}/twitter/tweets?tweet_ids=${tweetId}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Handle different HTTP status codes
      if (response.status === 429) {
        // Rate limit - retryable but wait a bit
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          continue;
        }
        throw new TwitterApiError(
          'Twitter API rate limit exceeded. Please try again later.',
          429,
          true
        );
      }
      
      if (response.status === 404) {
        // Tweet not found - not retryable
        throw new TwitterApiError(
          `Tweet with ID ${tweetId} not found. It may have been deleted.`,
          404,
          false
        );
      }
      
      if (response.status === 401 || response.status === 403) {
        // Authentication error - not retryable
        throw new TwitterApiError(
          'Twitter API authentication failed. Please check your API key.',
          response.status,
          false
        );
      }
      
      if (response.status === 402) {
        // Payment required - credits exhausted
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || 'Twitter API credits exhausted';
        throw new TwitterApiError(
          `Twitter API credits insufficient: ${message}. Please recharge your account.`,
          402,
          false
        );
      }
      
      if (!response.ok) {
        // Other HTTP errors
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new TwitterApiError(
          `Twitter API responded with status ${response.status}: ${errorText}`,
          response.status,
          response.status >= 500 // Server errors are retryable
        );
      }
      
      const data: TwitterApiResponse = await response.json();
      
      if (data.status === 'error') {
        // API returned error status
        const errorMessage = data.message || 'Twitter API returned an error';
        throw new TwitterApiError(errorMessage, 400, false);
      }
      
      if (!data.tweets || data.tweets.length === 0) {
        throw new TwitterApiError(
          `No tweet found with ID: ${tweetId}`,
          404,
          false
        );
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
      // If it's a TwitterApiError and not retryable, throw immediately
      if (error instanceof TwitterApiError && !error.isRetryable) {
        throw error;
      }
      
      // If it's a timeout or network error, retry if attempts remain
      if (
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof TypeError && error.message.includes('fetch'))
      ) {
        if (attempt < retries) {
          console.warn(`Network error on attempt ${attempt + 1}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          continue;
        }
        throw new TwitterApiError(
          'Network error: Failed to connect to Twitter API',
          0,
          true
        );
      }
      
      // If it's a retryable error and we have attempts left, retry
      if (error instanceof TwitterApiError && error.isRetryable && attempt < retries) {
        console.warn(`Retryable error on attempt ${attempt + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      // Re-throw if we've exhausted retries or it's not retryable
      throw error instanceof TwitterApiError
        ? error
        : new TwitterApiError(
            error instanceof Error ? error.message : 'Failed to fetch tweet metrics from external API',
            500,
            true
          );
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw new TwitterApiError('Failed to fetch tweet metrics after retries', 500, false);
}

/**
 * Fetch full tweet details including author information
 */
export async function fetchTweetDetails(
  tweetId: string,
  retries: number = 1
): Promise<TweetDetails> {
  const apiKey = process.env.TWITTER_API_KEY;
  
  if (!apiKey) {
    throw new TwitterApiError('TWITTER_API_KEY environment variable is not set', 500, false);
  }
  
  const apiUrl = process.env.TWITTER_API_URL || 'https://api.twitterapi.io';
  const url = `${apiUrl}/twitter/tweets?tweet_ids=${tweetId}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        throw new TwitterApiError(
          'Twitter API rate limit exceeded. Please try again later.',
          429,
          true
        );
      }
      
      if (response.status === 404) {
        throw new TwitterApiError(
          `Tweet with ID ${tweetId} not found. It may have been deleted.`,
          404,
          false
        );
      }
      
      if (response.status === 401 || response.status === 403) {
        throw new TwitterApiError(
          'Twitter API authentication failed. Please check your API key.',
          response.status,
          false
        );
      }
      
      if (response.status === 402) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || 'Twitter API credits exhausted';
        throw new TwitterApiError(
          `Twitter API credits insufficient: ${message}. Please recharge your account.`,
          402,
          false
        );
      }
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new TwitterApiError(
          `Twitter API responded with status ${response.status}: ${errorText}`,
          response.status,
          response.status >= 500
        );
      }
      
      const data: TwitterApiResponse = await response.json();
      
      if (data.status === 'error') {
        const errorMessage = data.message || 'Twitter API returned an error';
        throw new TwitterApiError(errorMessage, 400, false);
      }
      
      if (!data.tweets || data.tweets.length === 0) {
        throw new TwitterApiError(
          `No tweet found with ID: ${tweetId}`,
          404,
          false
        );
      }
      
      const tweet = data.tweets[0];
      const author = tweet.author;
      
      return {
        id: tweet.id,
        authorName: author?.name || 'Unknown',
        authorUsername: author?.userName || author?.screen_name,
        metrics: {
          likeCount: tweet.likeCount || 0,
          retweetCount: tweet.retweetCount || 0,
          replyCount: tweet.replyCount || 0,
          quoteCount: tweet.quoteCount || 0,
          viewCount: tweet.viewCount || 0,
          bookmarkCount: 0, // Not always available in this endpoint
          last_updated: new Date(),
        },
      };
    } catch (error) {
      if (error instanceof TwitterApiError && !error.isRetryable) {
        throw error;
      }
      
      if (
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof TypeError && error.message.includes('fetch'))
      ) {
        if (attempt < retries) {
          console.warn(`Network error on attempt ${attempt + 1}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw new TwitterApiError(
          'Network error: Failed to connect to Twitter API',
          0,
          true
        );
      }
      
      if (error instanceof TwitterApiError && error.isRetryable && attempt < retries) {
        console.warn(`Retryable error on attempt ${attempt + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      throw error instanceof TwitterApiError
        ? error
        : new TwitterApiError(
            error instanceof Error ? error.message : 'Failed to fetch tweet details from external API',
            500,
            true
          );
    }
  }
  
  throw new TwitterApiError('Failed to fetch tweet details after retries', 500, false);
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

/**
 * Fetch one page of quote tweets for a given tweet.
 * Supports pagination via next_cursor.
 */
export async function fetchTweetQuotesPage(
  tweetId: string,
  cursor?: string,
  retries: number = 1
): Promise<TwitterQuotesResponse> {
  const apiKey = process.env.TWITTER_API_KEY;

  if (!apiKey) {
    throw new TwitterApiError('TWITTER_API_KEY environment variable is not set', 500, false);
  }

  const apiUrl = process.env.TWITTER_API_URL || 'https://api.twitterapi.io';
  const params = new URLSearchParams({ tweet_id: tweetId });
  if (cursor) {
    params.append('cursor', cursor);
  }
  const url = `${apiUrl}/twitter/tweet/quotes?${params.toString()}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        throw new TwitterApiError(
          'Twitter API rate limit exceeded. Please try again later.',
          429,
          true
        );
      }

      if (response.status === 404) {
        throw new TwitterApiError(
          `Quote tweets for ${tweetId} not found.`,
          404,
          false
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new TwitterApiError(
          'Twitter API authentication failed. Please check your API key.',
          response.status,
          false
        );
      }

      if (response.status === 402) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || 'Twitter API credits exhausted';
        throw new TwitterApiError(
          `Twitter API credits insufficient: ${message}. Please recharge your account.`,
          402,
          false
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new TwitterApiError(
          `Twitter API responded with status ${response.status}: ${errorText}`,
          response.status,
          response.status >= 500
        );
      }

      const data: TwitterQuotesResponse = await response.json();

      if (data.status === 'error') {
        const errorMessage = data.message || 'Twitter API returned an error';
        throw new TwitterApiError(errorMessage, 400, false);
      }

      return data;
    } catch (error) {
      if (error instanceof TwitterApiError && !error.isRetryable) {
        throw error;
      }

      if (
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof TypeError && error.message.includes('fetch'))
      ) {
        if (attempt < retries) {
          console.warn(`Network error on attempt ${attempt + 1} (quotes), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw new TwitterApiError(
          'Network error: Failed to connect to Twitter API (quotes)',
          0,
          true
        );
      }

      if (error instanceof TwitterApiError && error.isRetryable && attempt < retries) {
        console.warn(`Retryable error on attempt ${attempt + 1} (quotes), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      throw error instanceof TwitterApiError
        ? error
        : new TwitterApiError(
            error instanceof Error ? error.message : 'Failed to fetch quote tweets from external API',
            500,
            true
          );
    }
  }

  throw new TwitterApiError('Failed to fetch quote tweets after retries', 500, false);
}

/**
 * Aggregate quote tweets across all pages with a small delay between pages.
 * Returns total quote tweets and summed view counts.
 */
export async function fetchQuoteMetricsAggregate(
  tweetId: string,
  options: {
    pageDelayMs?: number;
    maxPages?: number;
  } = {}
): Promise<{ quoteTweetCount: number; quoteViewSum: number }> {
  const pageDelayMs = options.pageDelayMs ?? 300; // default 300ms between pages
  const maxPages = options.maxPages ?? 50; // safety cap

  let cursor: string | undefined = undefined;
  let hasNext = true;
  let page = 0;
  let quoteTweetCount = 0;
  let quoteViewSum = 0;
  const seen = new Set<string>();

  while (hasNext && page < maxPages) {
    const data = await fetchTweetQuotesPage(tweetId, cursor);
    page += 1;

    const tweets = data.tweets || [];
    console.log(
      `[quotes] page=${page} tweets=${tweets.length} cursor=${cursor ?? 'none'} has_next_page=${(data as any).has_next_page} next_cursor=${(data as any).next_cursor}`
    );

    if (tweets.length === 0) {
      console.warn(`[quotes] empty tweets array for tweetId=${tweetId} on page=${page}`);
    }

    for (const t of tweets) {
      if (!t?.id) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      quoteTweetCount += 1;
      const viewCount = (t as any).viewCount ?? 0;
      quoteViewSum += typeof viewCount === 'number' ? viewCount : 0;
    }

    const hasNextPage = (data as any).has_next_page === true || (data as any).hasNextPage === true;
    hasNext = hasNextPage && !!data.next_cursor;
    cursor = data.next_cursor;

    if (hasNext) {
      await new Promise(resolve => setTimeout(resolve, pageDelayMs));
    }
  }

  console.log(
    `[quotes] aggregate complete for tweetId=${tweetId}: quoteTweetCount=${quoteTweetCount}, quoteViewSum=${quoteViewSum}, pages=${page}, maxPagesCap=${maxPages}`
  );

  return { quoteTweetCount, quoteViewSum };
}

