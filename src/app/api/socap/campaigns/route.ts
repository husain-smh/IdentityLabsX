import { NextRequest, NextResponse } from 'next/server';
import {
  createCampaign,
  getAllCampaigns,
  CreateCampaignInput,
} from '@/lib/models/socap/campaigns';
import {
  createCampaignTweet,
} from '@/lib/models/socap/tweets';
import {
  createWorkerState,
} from '@/lib/models/socap/worker-state';
import {
  resolveTweetUrls,
} from '@/lib/socap/tweet-resolver';

// Retry helper for MongoDB operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's a MongoDB connection error
      const isConnectionError = errorMessage.includes('MongoServerSelectionError') || 
                                errorMessage.includes('timeout') ||
                                errorMessage.includes('ECONNRESET') ||
                                errorMessage.includes('connection') ||
                                errorMessage.includes('MongoError');
      
      if (isConnectionError && attempt < maxRetries) {
        const waitTime = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⚠️ Attempt ${attempt}/${maxRetries} failed with connection error. Retrying in ${waitTime}ms...`);
        console.log(`   Error: ${errorMessage}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // If not a connection error or last attempt, throw
      throw error;
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

/**
 * GET /socap/campaigns
 * List all campaigns
 */
export async function GET(_request: NextRequest) {
  try {
    const campaigns = await withRetry(() => getAllCampaigns(), 3, 1000);
    
    return NextResponse.json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    
    // Provide more helpful error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isConnectionError = errorMessage.includes('MongoServerSelectionError') || 
                              errorMessage.includes('timeout');
    
    return NextResponse.json(
      {
        success: false,
        error: isConnectionError 
          ? 'Failed to connect to MongoDB. Please check your network connection and MongoDB Atlas IP whitelist settings.'
          : 'Failed to fetch campaigns',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /socap/campaigns
 * Create a new campaign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.launch_name || !body.client_info || !body.monitor_window) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: launch_name, client_info, monitor_window',
        },
        { status: 400 }
      );
    }
    
    // Resolve all tweet URLs
    const allTweetUrls = [
      ...(body.maintweets || []).map((t: { url: string }) => t.url),
      ...(body.influencer_twts || []).map((t: { url: string }) => t.url),
      ...(body.investor_twts || []).map((t: { url: string }) => t.url),
    ];
    
    if (allTweetUrls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one tweet URL is required',
        },
        { status: 400 }
      );
    }
    
    // Resolve tweet URLs
    const resolvedTweets = await resolveTweetUrls(allTweetUrls);
    
    if (resolvedTweets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to resolve any tweet URLs',
        },
        { status: 400 }
      );
    }
    
    // Create campaign
    const campaignInput: CreateCampaignInput = {
      launch_name: body.launch_name,
      client_info: body.client_info,
      maintweets: body.maintweets || [],
      influencer_twts: body.influencer_twts || [],
      investor_twts: body.investor_twts || [],
      monitor_window: body.monitor_window,
      alert_preferences: {
        importance_threshold: body.alert_preferences?.importance_threshold || 10,
        channels: body.alert_preferences?.channels || ['email'],
        frequency_window_minutes: body.alert_preferences?.frequency_window_minutes || 30,
        alert_spacing_minutes: body.alert_preferences?.alert_spacing_minutes || 20,
      },
    };
    
    const campaign = await createCampaign(campaignInput);
    
    // Create tweet documents and worker states
    const tweetMap = new Map<string, { url: string; category: 'main_twt' | 'influencer_twt' | 'investor_twt' }>();
    
    (body.maintweets || []).forEach((t: { url: string }) => {
      tweetMap.set(t.url, { url: t.url, category: 'main_twt' });
    });
    
    (body.influencer_twts || []).forEach((t: { url: string }) => {
      tweetMap.set(t.url, { url: t.url, category: 'influencer_twt' });
    });
    
    (body.investor_twts || []).forEach((t: { url: string }) => {
      tweetMap.set(t.url, { url: t.url, category: 'investor_twt' });
    });
    
    // Create tweets and worker states
    const jobTypes: Array<'retweets' | 'replies' | 'quotes' | 'metrics'> = [
      'retweets',
      'replies',
      'quotes',
      'metrics',
    ];
    
    for (const resolvedTweet of resolvedTweets) {
      const tweetInfo = tweetMap.get(resolvedTweet.tweet_url);
      if (!tweetInfo) continue;
      
      // Create tweet document
      await createCampaignTweet(
        campaign._id!,
        resolvedTweet.tweet_id,
        resolvedTweet.tweet_url,
        tweetInfo.category,
        resolvedTweet.author_name,
        resolvedTweet.author_username
      );
      
      // Create worker states for each job type
      for (const jobType of jobTypes) {
        await createWorkerState({
          campaign_id: campaign._id!,
          tweet_id: resolvedTweet.tweet_id,
          job_type: jobType,
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        campaign,
        tweets_created: resolvedTweets.length,
      },
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create campaign',
      },
      { status: 500 }
    );
  }
}

