/**
 * Native Tweet Analysis Endpoint
 * Replaces N8N webhook call with native implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTweetIdFromUrl } from '@/lib/utils/tweet-utils';
import { getTweet } from '@/lib/models/tweets';
import { fetchTweetDetails } from '@/lib/external-api';
import { jobQueue } from '@/lib/jobs/analyze-tweet-job';
import { logger } from '@/lib/logger';
import { TwitterApiError } from '@/lib/external-api';

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  logger.setRequestId(requestId);

  try {
    const body = await request.json();
    const { tweetUrl, reanalyze = false } = body;

    logger.info('Received analysis request', { tweetUrl, reanalyze });

    // Validate tweet URL
    if (!tweetUrl || typeof tweetUrl !== 'string') {
      return NextResponse.json(
        { error: 'Tweet URL is required' },
        { status: 400 }
      );
    }

    // Basic Twitter URL validation
    const twitterUrlPattern = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
    if (!twitterUrlPattern.test(tweetUrl)) {
      return NextResponse.json(
        { error: 'Please provide a valid Twitter/X tweet URL' },
        { status: 400 }
      );
    }

    // Extract tweet ID from URL
    const tweetId = extractTweetIdFromUrl(tweetUrl);
    if (!tweetId) {
      return NextResponse.json(
        { error: 'Could not extract tweet ID from URL' },
        { status: 400 }
      );
    }

    logger.info('Extracted tweet ID', { tweetId });

    // Check if tweet has already been analyzed (unless reanalyze flag is set)
    if (!reanalyze) {
      const existingTweet = await getTweet(tweetId);
      
      if (existingTweet) {
        logger.info('Tweet already exists', { tweetId, status: existingTweet.status });
        
        return NextResponse.json({
          already_exists: true,
          tweet_id: tweetId,
          status: existingTweet.status,
          author_name: existingTweet.author_name,
          total_engagers: existingTweet.total_engagers,
          engagers_above_10k: existingTweet.engagers_above_10k,
          engagers_below_10k: existingTweet.engagers_below_10k,
          analyzed_at: existingTweet.analyzed_at,
          created_at: existingTweet.created_at,
          message: existingTweet.status === 'completed' 
            ? 'This tweet has already been analyzed' 
            : existingTweet.status === 'analyzing'
            ? 'This tweet is currently being analyzed'
            : existingTweet.status === 'pending'
            ? 'This tweet analysis is queued'
            : 'Previous analysis failed',
        });
      }
    }

    // Fetch tweet details to get author information
    let tweetDetails;
    try {
      tweetDetails = await fetchTweetDetails(tweetId);
      logger.info('Tweet details fetched', { tweetId, authorName: tweetDetails.authorName });
    } catch (error) {
      logger.error('Failed to fetch tweet details', error, { tweetId });
      
      if (error instanceof TwitterApiError) {
        if (error.statusCode === 404) {
          return NextResponse.json(
            { error: 'Tweet not found. The tweet may have been deleted or the URL is incorrect.' },
            { status: 404 }
          );
        }
        if (error.statusCode === 429) {
          return NextResponse.json(
            { error: 'Twitter API rate limit exceeded. Please try again in a few minutes.' },
            { status: 429 }
          );
        }
        if (error.statusCode === 402) {
          return NextResponse.json(
            { error: 'Twitter API credits exhausted. Please recharge your API account.' },
            { status: 402 }
          );
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch tweet details',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Use author info from fetched tweet details
    const authorName = tweetDetails.authorName;
    const authorUsername = tweetDetails.authorUsername;

    // Enqueue background job
    const jobId = await jobQueue.enqueue(tweetId, tweetUrl, {
      reanalyze,
      authorName,
      authorUsername,
    });

    logger.info('Job enqueued', { jobId, tweetId });

    // Return immediately
    return NextResponse.json({
      success: true,
      message: 'Analysis started. Processing in background.',
      tweet_id: tweetId,
      job_id: jobId,
      status: 'analyzing',
      view_url: `/tweets/${tweetId}`,
    });

  } catch (error) {
    logger.error('Error in analyze-native endpoint', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to start analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

