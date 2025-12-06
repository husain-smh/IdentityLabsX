import { NextRequest, NextResponse } from 'next/server';
import { getCampaignById } from '@/lib/models/socap/campaigns';
import { getTweetsByCampaign } from '@/lib/models/socap/tweets';
import {
  getEngagementCountByCampaign,
  getUniqueEngagersByCampaign,
  getAllUniqueEngagersByCampaign,
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
    
    // Calculate total metrics + per-category breakdown (for cards)
    let totalLikes = 0;
    let totalRetweets = 0;
    let totalQuotes = 0;
    let totalReplies = 0;
    let totalViews = 0;
    let totalQuoteViews = 0;

    const categoryTotals = {
      main_twt: { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0 },
      influencer_twt: { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0 },
      investor_twt: { likes: 0, retweets: 0, quotes: 0, replies: 0, views: 0 },
    };
    
    for (const tweet of tweets) {
      const metrics = tweet.metrics;
      const category = tweet.category as keyof typeof categoryTotals;

      totalLikes += metrics.likeCount;
      totalRetweets += metrics.retweetCount;
      totalQuotes += metrics.quoteCount;
      totalReplies += metrics.replyCount;
      totalViews += metrics.viewCount;
      // Safe access for older documents without quoteViewsFromQuotes
      totalQuoteViews += (metrics as any).quoteViewsFromQuotes || 0;

      if (categoryTotals[category]) {
        categoryTotals[category].likes += metrics.likeCount;
        categoryTotals[category].retweets += metrics.retweetCount;
        categoryTotals[category].quotes += metrics.quoteCount;
        categoryTotals[category].replies += metrics.replyCount;
        categoryTotals[category].views += metrics.viewCount;
      }
    }
    
    // Get engagement counts
    const totalEngagements = await getEngagementCountByCampaign(id);
    const uniqueEngagers = await getUniqueEngagersByCampaign(id);
    
    // Get ALL unique engagers (one per user) with their aggregated data
    // This ensures we can display all accounts that have engaged
    const uniqueEngagersData = await getAllUniqueEngagersByCampaign(id);
    
    // We need to expand the _all_actions field back into individual engagement records
    // so the frontend grouping logic works correctly
    const latestEngagements: any[] = [];
    for (const engager of uniqueEngagersData) {
      const allActions = (engager as any)._all_actions || [];
      if (allActions.length > 0) {
        // Create one engagement record per action
        for (const action of allActions) {
          latestEngagements.push({
            ...engager,
            action_type: action.action_type,
            tweet_id: action.tweet_id,
            tweet_category: action.tweet_category,
            timestamp: action.timestamp,
            engagement_tweet_id: action.engagement_tweet_id,
            // Remove the _all_actions field
            _all_actions: undefined,
          });
        }
      } else {
        // Fallback: use the engager as a single engagement
        const { _all_actions, ...engagement } = engager as any;
        latestEngagements.push(engagement);
      }
    }
    
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
        category_totals: categoryTotals,
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

