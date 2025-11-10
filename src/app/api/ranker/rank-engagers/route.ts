import { NextRequest, NextResponse } from 'next/server';
import { rankEngagers, saveEngagementRanking, EngagerInput } from '@/lib/models/ranker';

// POST - Rank a list of engagers by importance score
// Supports two input formats:
// 1. Object format: { tweet_id: "123", engagers: [...] }
// 2. N8N array format: [{ sheetdata: [{ tweet_url: "..." }] }, { username: "...", userId: "..." }, ...]
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    let tweet_id: string;
    let engagers: any[];

    // Check if body is an array (N8N format) or object (direct API format)
    if (Array.isArray(body)) {
      console.log('📦 Received N8N array format with', body.length, 'items');
      
      // Find the sheetdata item (first item with tweet_url)
      const sheetDataItem = body.find((item: any) => item.sheetdata);
      
      if (!sheetDataItem || !sheetDataItem.sheetdata || !sheetDataItem.sheetdata[0]?.tweet_url) {
        return NextResponse.json(
          { error: 'First array item must contain sheetdata with tweet_url' },
          { status: 400 }
        );
      }

      const tweetUrl = sheetDataItem.sheetdata[0].tweet_url;
      
      // Extract tweet ID from URL (format: https://x.com/username/status/1234567890)
      const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
      if (!tweetIdMatch) {
        return NextResponse.json(
          { error: `Could not extract tweet_id from URL: ${tweetUrl}` },
          { status: 400 }
        );
      }
      
      tweet_id = tweetIdMatch[1];
      
      // Filter out sheetdata item and get remaining engagers
      engagers = body.filter((item: any) => !item.sheetdata);
      
      console.log(`✅ Extracted tweet_id: ${tweet_id} from URL: ${tweetUrl}`);
      console.log(`✅ Found ${engagers.length} engagers`);
      
    } else {
      // Original object format
      console.log('📦 Received object format');
      tweet_id = body.tweet_id;
      engagers = body.engagers;

      // Validation for object format
      if (!tweet_id || typeof tweet_id !== 'string') {
        return NextResponse.json(
          { error: 'tweet_id is required and must be a string' },
          { status: 400 }
        );
      }
    }

    // Common validation for both formats
    if (!Array.isArray(engagers) || engagers.length === 0) {
      return NextResponse.json(
        { error: 'engagers is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate engagers array
    for (const engager of engagers) {
      if (!engager.username || !engager.userId) {
        return NextResponse.json(
          { error: 'Each engager must have username and userId' },
          { status: 400 }
        );
      }
    }

    // Prepare engagers list (preserving all metadata)
    const engagersObj: EngagerInput[] = engagers.map((engager: any) => ({
      username: engager.username.trim(),
      userId: engager.userId.trim(),
      name: engager.name ? engager.name.trim() : engager.username.trim(),
      bio: engager.bio,
      location: engager.location,
      followers: engager.followers,
      verified: engager.verified,
      replied: engager.replied,
      retweeted: engager.retweeted,
      quoted: engager.quoted,
    }));

    console.log(`Ranking ${engagersObj.length} engagers for tweet ${tweet_id}`);
    
    // Rank the engagers
    const rankedEngagers = await rankEngagers(engagersObj);
    
    // Save the ranking result
    await saveEngagementRanking(tweet_id, rankedEngagers);
    
    console.log(`Ranking complete. Top engagers:`);
    rankedEngagers.slice(0, 5).forEach((e, i) => {
      console.log(`  ${i + 1}. @${e.username} - Score: ${e.importance_score}`);
    });

    // Transform followed_by to just usernames array
    const simplifiedEngagers = rankedEngagers.map(engager => ({
      ...engager,
      followed_by: engager.followed_by.map(person => person.username),
    }));

    // Prepare response with statistics
    const totalEngagers = simplifiedEngagers.length;
    const engagersWithScore = simplifiedEngagers.filter(e => e.importance_score > 0).length;
    const engagersWithoutScore = totalEngagers - engagersWithScore;
    const maxScore = simplifiedEngagers.length > 0 ? simplifiedEngagers[0].importance_score : 0;
    const avgScore = simplifiedEngagers.length > 0
      ? simplifiedEngagers.reduce((sum, e) => sum + e.importance_score, 0) / simplifiedEngagers.length
      : 0;

    // Return simplified response without wrapper
    return NextResponse.json({
      tweet_id,
      ranked_engagers: simplifiedEngagers,
      statistics: {
        total_engagers: totalEngagers,
        engagers_with_score: engagersWithScore,
        engagers_without_score: engagersWithoutScore,
        max_score: maxScore,
        avg_score: parseFloat(avgScore.toFixed(2)),
      },
      analyzed_at: new Date(),
    });

  } catch (error) {
    console.error('Error ranking engagers:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to rank engagers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

