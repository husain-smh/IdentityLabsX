import { NextRequest, NextResponse } from 'next/server';
import { getCampaignById } from '@/lib/models/socap/campaigns';
import { getTweetsByCampaign } from '@/lib/models/socap/tweets';
import {
  getEngagementsByCampaign,
  getEngagementCountByCampaign,
  getUniqueEngagersByCampaign,
} from '@/lib/models/socap/engagements';

/**
 * GET /socap/campaigns/:id/dashboard
 * Get dashboard data for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaign = await getCampaignById(id);
    
    if (!campaign) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign not found',
        },
        { status: 404 }
      );
    }
    
    // Get tweets
    const tweets = await getTweetsByCampaign(id);
    
    // Calculate total metrics
    let totalLikes = 0;
    let totalRetweets = 0;
    let totalQuotes = 0;
    let totalReplies = 0;
    let totalViews = 0;
    let totalQuoteViews = 0;
    
    for (const tweet of tweets) {
      totalLikes += tweet.metrics.likeCount;
      totalRetweets += tweet.metrics.retweetCount;
      totalQuotes += tweet.metrics.quoteCount;
      totalReplies += tweet.metrics.replyCount;
      totalViews += tweet.metrics.viewCount;
      // Safe access for older documents without quoteViewsFromQuotes
      totalQuoteViews += (tweet.metrics as any).quoteViewsFromQuotes || 0;
    }
    
    // Get engagement counts
    const totalEngagements = await getEngagementCountByCampaign(id);
    const uniqueEngagers = await getUniqueEngagersByCampaign(id);
    
    // Get latest engagements - fetch more to ensure we get at least 20 unique people
    const latestEngagements = await getEngagementsByCampaign(id, {
      limit: 200,
      sort: 'importance_score',
    });
    
    // Calculate category breakdown
    const categoryCounts: Record<string, number> = {};
    for (const engagement of latestEngagements) {
      for (const category of engagement.account_categories || []) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        campaign,
        metrics: {
          total_likes: totalLikes,
          total_retweets: totalRetweets,
          total_quotes: totalQuotes,
          total_replies: totalReplies,
          total_views: totalViews,
          total_quote_views: totalQuoteViews,
          total_engagements: totalEngagements,
          unique_engagers: uniqueEngagers,
        },
        tweets: tweets.map((t) => ({
          tweet_id: t.tweet_id,
          category: t.category,
          author_username: t.author_username,
          metrics: t.metrics,
        })),
        latest_engagements: latestEngagements,
        category_breakdown: categoryCounts,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard data',
      },
      { status: 500 }
    );
  }
}

