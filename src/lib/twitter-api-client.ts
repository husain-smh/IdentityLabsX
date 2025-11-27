/**
 * Twitter API Client - Handles fetching replies, retweets, and quotes
 * with pagination, rate limiting, and immediate data transformation
 */

import { TwitterApiError } from './external-api';
import { getTwitterApiConfig } from './config/twitter-api-config';
import { RateLimitError } from './errors/analysis-errors';

export interface FilteredUser {
  userId: string;
  username: string | null;
  name: string | null;
  followers: number;
  verified: boolean;
  bio: string | null;
  location: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
  totalFetched: number;
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let nextAvailableTime = 0;
let limiterChain: Promise<void> = Promise.resolve();

async function scheduleGlobalRateLimit(config: ReturnType<typeof getTwitterApiConfig>): Promise<void> {
  const qps = Math.max(0, config.qpsLimit || 0);
  if (qps <= 0) {
    return;
  }

  const interval = Math.ceil(1000 / qps);

  let release: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });

  const previous = limiterChain;
  limiterChain = previous.then(() => current);

  await previous;

  const now = Date.now();
  const waitTime = Math.max(0, nextAvailableTime - now);
  nextAvailableTime = Math.max(now, nextAvailableTime) + interval;

  release!();

  if (waitTime > 0) {
    await sleep(waitTime);
  }
}

/**
 * Make API request with retry logic
 */
async function makeApiRequest(
  url: string,
  config: ReturnType<typeof getTwitterApiConfig>,
  retries = 0
): Promise<any> {
  await scheduleGlobalRateLimit(config);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.requestTimeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
      if (retries < config.maxRetries) {
        await sleep(retryAfter * 1000);
        return makeApiRequest(url, config, retries + 1);
      }
      throw new RateLimitError(retryAfter, 'Twitter API rate limit exceeded');
    }

    if (response.status === 404) {
      throw new TwitterApiError(
        'Tweet not found',
        404,
        false,
        'TWEET_NOT_FOUND'
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new TwitterApiError(
        'Twitter API authentication failed',
        response.status,
        false,
        'AUTH_ERROR'
      );
    }

    if (response.status === 402) {
      const errorData = await response.json().catch(() => ({}));
      throw new TwitterApiError(
        errorData.message || 'Twitter API credits exhausted',
        402,
        false,
        'CREDITS_EXHAUSTED'
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new TwitterApiError(
        `Twitter API error: ${errorText}`,
        response.status,
        response.status >= 500,
        'API_ERROR'
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof TwitterApiError || error instanceof RateLimitError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      if (retries < config.maxRetries) {
        await sleep(config.retryDelay);
        return makeApiRequest(url, config, retries + 1);
      }
      throw new TwitterApiError(
        'Request timeout',
        0,
        true,
        'TIMEOUT'
      );
    }

    if (retries < config.maxRetries) {
      await sleep(config.retryDelay);
      return makeApiRequest(url, config, retries + 1);
    }

    throw new TwitterApiError(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      true,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Transform tweet author to FilteredUser
 */
function transformTweetAuthor(author: any): FilteredUser | null {
  if (!author || !author.id) return null;

  const isVerified = author.isBlueVerified !== undefined
    ? Boolean(author.isBlueVerified)
    : Boolean(author.verified);

  return {
    userId: author.id,
    username: author.userName || author.screen_name || null,
    name: author.name || null,
    followers: parseInt(author.followers || author.followers_count || '0', 10) || 0,
    verified: isVerified,
    bio: author.profile_bio?.description || null,
    location: author.location || null,
  };
}

/**
 * Transform user object to FilteredUser
 */
function transformUser(user: any): FilteredUser | null {
  if (!user || !user.id) return null;

  const isVerified = user.isBlueVerified !== undefined
    ? Boolean(user.isBlueVerified)
    : Boolean(user.verified);

  return {
    userId: user.id,
    username: user.userName || user.username || user.screen_name || null,
    name: user.name || null,
    followers: parseInt(user.followers || user.followers_count || '0', 10) || 0,
    verified: isVerified,
    bio: user.description || null,
    location: user.location || null,
  };
}

/**
 * Fetch tweet replies with pagination
 */
export async function fetchTweetReplies(
  tweetId: string,
  options: {
    maxPages?: number;
    cursor?: string;
  } = {}
): Promise<PaginatedResponse<FilteredUser>> {
  const config = getTwitterApiConfig();
  const maxPages = options.maxPages || config.maxPages.replies;
  
  if (!config.apiKey) {
    throw new TwitterApiError(
      'TWITTER_API_KEY not configured',
      500,
      false,
      'CONFIG_ERROR'
    );
  }

  const allUsers: FilteredUser[] = [];
  let currentCursor = options.cursor;
  let pagesFetched = 0;
  let hasMore = true;

  while (hasMore && pagesFetched < maxPages) {
    const url = new URL(`${config.apiUrl}/twitter/tweet/replies`);
    url.searchParams.set('tweetId', tweetId);
    if (currentCursor) {
      url.searchParams.set('cursor', currentCursor);
    }

    const data = await makeApiRequest(url.toString(), config);

    // Transform and filter data immediately
    if (data.tweets && Array.isArray(data.tweets)) {
      for (const tweet of data.tweets) {
        if (tweet.author) {
          const user = transformTweetAuthor(tweet.author);
          if (user) {
            allUsers.push(user);
          }
        }
      }
    }

    // Check if there's more data
    currentCursor = data.next_cursor;
    hasMore = data.tweets && data.tweets.length > 0 && !!currentCursor;

    pagesFetched++;

    // Rate limiting delay between pages
    if (hasMore && pagesFetched < maxPages) {
      await sleep(config.rateLimitDelay);
    }
  }

  return {
    data: allUsers,
    hasMore,
    nextCursor: currentCursor,
    totalFetched: allUsers.length,
  };
}

/**
 * Fetch tweet retweets with pagination
 */
export async function fetchTweetRetweets(
  tweetId: string,
  options: {
    maxPages?: number;
    cursor?: string;
  } = {}
): Promise<PaginatedResponse<FilteredUser>> {
  const config = getTwitterApiConfig();
  const maxPages = options.maxPages || config.maxPages.retweets;
  
  if (!config.apiKey) {
    throw new TwitterApiError(
      'TWITTER_API_KEY not configured',
      500,
      false,
      'CONFIG_ERROR'
    );
  }

  const allUsers: FilteredUser[] = [];
  let currentCursor = options.cursor;
  let pagesFetched = 0;
  let hasMore = true;

  while (hasMore && pagesFetched < maxPages) {
    const url = new URL(`${config.apiUrl}/twitter/tweet/retweeters`);
    url.searchParams.set('tweetId', tweetId);
    if (currentCursor) {
      url.searchParams.set('cursor', currentCursor);
    }

    const data = await makeApiRequest(url.toString(), config);

    // Transform and filter data immediately
    if (data.users && Array.isArray(data.users)) {
      for (const user of data.users) {
        const filteredUser = transformUser(user);
        if (filteredUser) {
          allUsers.push(filteredUser);
        }
      }
    }

    // Check if there's more data
    currentCursor = data.next_cursor;
    hasMore = data.users && data.users.length > 0 && !!currentCursor;

    pagesFetched++;

    // Rate limiting delay between pages
    if (hasMore && pagesFetched < maxPages) {
      await sleep(config.rateLimitDelay);
    }
  }

  return {
    data: allUsers,
    hasMore,
    nextCursor: currentCursor,
    totalFetched: allUsers.length,
  };
}

/**
 * Fetch tweet quotes with pagination
 */
export async function fetchTweetQuotes(
  tweetId: string,
  options: {
    maxPages?: number;
    cursor?: string;
  } = {}
): Promise<PaginatedResponse<FilteredUser>> {
  const config = getTwitterApiConfig();
  const maxPages = options.maxPages || config.maxPages.quotes;
  
  if (!config.apiKey) {
    throw new TwitterApiError(
      'TWITTER_API_KEY not configured',
      500,
      false,
      'CONFIG_ERROR'
    );
  }

  const allUsers: FilteredUser[] = [];
  let currentCursor = options.cursor;
  let pagesFetched = 0;
  let hasMore = true;

  while (hasMore && pagesFetched < maxPages) {
    const url = new URL(`${config.apiUrl}/twitter/tweet/quotes`);
    url.searchParams.set('tweetId', tweetId);
    if (currentCursor) {
      url.searchParams.set('cursor', currentCursor);
    }

    const data = await makeApiRequest(url.toString(), config);

    // Transform and filter data immediately
    if (data.tweets && Array.isArray(data.tweets)) {
      for (const tweet of data.tweets) {
        if (tweet.author) {
          const user = transformTweetAuthor(tweet.author);
          if (user) {
            allUsers.push(user);
          }
        }
      }
    }

    // Check if there's more data
    currentCursor = data.next_cursor;
    hasMore = data.tweets && data.tweets.length > 0 && (data.has_next_page !== false) && !!currentCursor;

    pagesFetched++;

    // Rate limiting delay between pages
    if (hasMore && pagesFetched < maxPages) {
      await sleep(config.rateLimitDelay);
    }
  }

  return {
    data: allUsers,
    hasMore,
    nextCursor: currentCursor,
    totalFetched: allUsers.length,
  };
}

