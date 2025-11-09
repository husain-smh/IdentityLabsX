import { NextRequest, NextResponse } from 'next/server';
import { rankEngagers, saveEngagementRanking, EngagerInput } from '@/lib/models/ranker';

// POST - Rank a list of engagers by importance score
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweet_id, engagers } = body;

    // Validation
    if (!tweet_id || typeof tweet_id !== 'string') {
      return NextResponse.json(
        { error: 'tweet_id is required and must be a string' },
        { status: 400 }
      );
    }

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

    // Prepare response with statistics
    const totalEngagers = rankedEngagers.length;
    const engagersWithScore = rankedEngagers.filter(e => e.importance_score > 0).length;
    const engagersWithoutScore = totalEngagers - engagersWithScore;
    const maxScore = rankedEngagers.length > 0 ? rankedEngagers[0].importance_score : 0;
    const avgScore = rankedEngagers.length > 0
      ? rankedEngagers.reduce((sum, e) => sum + e.importance_score, 0) / rankedEngagers.length
      : 0;

    return NextResponse.json({
      success: true,
      message: 'Engagers ranked successfully',
      data: {
        tweet_id,
        ranked_engagers: rankedEngagers,
        statistics: {
          total_engagers: totalEngagers,
          engagers_with_score: engagersWithScore,
          engagers_without_score: engagersWithoutScore,
          max_score: maxScore,
          avg_score: parseFloat(avgScore.toFixed(2)),
        },
        analyzed_at: new Date(),
      },
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

