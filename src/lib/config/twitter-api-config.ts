/**
 * Centralized configuration for Twitter API client
 */

export interface TwitterApiConfig {
  apiUrl: string;
  apiKey: string;
  rateLimitDelay: number; // ms between requests
  requestTimeout: number; // ms
  maxRetries: number;
  retryDelay: number; // ms
  qpsLimit: number;
  maxPages: {
    replies: number;
    retweets: number;
    quotes: number;
  };
}

export function getTwitterApiConfig(): TwitterApiConfig {
  return {
    apiUrl: process.env.TWITTER_API_URL || 'https://api.twitterapi.io',
    apiKey: process.env.TWITTER_API_KEY || '',
    rateLimitDelay: 500, // 500ms between paginated requests
    requestTimeout: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 2000, // 2 seconds
    qpsLimit: parseInt(process.env.TWITTER_QPS_LIMIT || '3', 10),
    maxPages: {
      replies: 50,
      retweets: 75,
      quotes: 60,
    },
  };
}

