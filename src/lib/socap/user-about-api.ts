/**
 * User About API integration for fetching accurate location data
 * API: https://api.twitterapi.io/twitter/user_about
 * 
 * This endpoint provides accurate location data (account_based_in) which is
 * more reliable than the user-provided location field.
 */

import { getTwitterApiKey, type TwitterApiKeyType } from '../config/twitter-api-config';
import { TwitterApiError } from '../external-api';

export interface UserAboutResponse {
  status: 'success' | 'error';
  msg?: string;
  data?: {
    id: string;
    name: string;
    userName: string;
    createdAt: string;
    isBlueVerified: boolean;
    protected: boolean;
    about_profile?: {
      account_based_in?: string;
      location_accurate?: boolean;
      learn_more_url?: string;
      affiliate_username?: string;
      source?: string;
      username_changes?: {
        count?: string;
        last_changed_at_msec?: string;
      };
    };
    affiliates_highlighted_label?: any;
    identity_profile_labels_highlighted_label?: any;
  };
}

/**
 * Fetch user about information including accurate location data
 * 
 * @param username - The Twitter username (without @)
 * @param retries - Number of retries (default: 2)
 * @param keyType - Which API key to use: 'monitor' (dedicated) or 'shared' (batch operations)
 * @returns UserAboutResponse with account_based_in location data
 */
export async function fetchUserAbout(
  username: string,
  retries: number = 2,
  keyType: TwitterApiKeyType = 'shared'
): Promise<UserAboutResponse> {
  const apiKey = getTwitterApiKey(keyType);
  
  if (!apiKey) {
    throw new TwitterApiError(
      'Twitter API key is not configured. Set TWITTER_API_KEY_MONITOR, TWITTER_API_KEY_SHARED, or TWITTER_API_KEY.',
      500,
      false
    );
  }
  
  // Remove @ if present
  const cleanUsername = username.replace(/^@/, '');
  
  const apiUrl = process.env.TWITTER_API_URL || 'https://api.twitterapi.io';
  const url = `${apiUrl}/twitter/user_about?userName=${encodeURIComponent(cleanUsername)}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
          const backoffDelay = Math.pow(2, attempt + 1) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.warn(`[user-about] Rate limited (429), backing off ${backoffDelay}ms before retry ${attempt + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        throw new TwitterApiError(
          'Twitter API rate limit exceeded. Please try again later.',
          429,
          true,
          undefined,
          { operation: 'fetchUserAbout', retryAfter: 60 }
        );
      }
      
      if (response.status === 404) {
        // User not found - not retryable
        throw new TwitterApiError(
          `User @${cleanUsername} not found. They may have been deleted or suspended.`,
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
      
      const data: UserAboutResponse = await response.json();
      
      if (data.status === 'error') {
        // API returned error status
        const errorMessage = data.msg || 'Twitter API returned an error';
        throw new TwitterApiError(errorMessage, 400, false);
      }
      
      if (!data.data) {
        throw new TwitterApiError(
          `No user data found for @${cleanUsername}`,
          404,
          false
        );
      }
      
      return data;
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
          const backoffDelay = Math.pow(2, attempt + 1) * 1000;
          console.warn(`[user-about] Network error on attempt ${attempt + 1}, backing off ${backoffDelay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
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
        const backoffDelay = Math.pow(2, attempt + 1) * 1000;
        console.warn(`[user-about] Retryable error on attempt ${attempt + 1}, backing off ${backoffDelay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }
      
      // Re-throw if we've exhausted retries or it's not retryable
      throw error instanceof TwitterApiError
        ? error
        : new TwitterApiError(
            error instanceof Error ? error.message : 'Failed to fetch user about from external API',
            500,
            true
          );
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw new TwitterApiError('Failed to fetch user about after retries', 500, false);
}

/**
 * Extract account_based_in location from user about response
 * 
 * @param response - UserAboutResponse from API
 * @returns The account_based_in location string, or undefined if not available
 */
export function extractAccountBasedIn(response: UserAboutResponse): string | undefined {
  return response.data?.about_profile?.account_based_in;
}

