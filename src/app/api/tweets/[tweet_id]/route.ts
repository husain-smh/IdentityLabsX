import { NextRequest, NextResponse } from 'next/server';
import { getTweetById, getEngagers, getEngagerCount } from '@/lib/models/tweet-analysis';

// GET - Get tweet details with engagers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tweet_id: string }> }
) {
  try {
    const { tweet_id } = await params;
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    const minFollowers = searchParams.get('minFollowers') 
      ? parseInt(searchParams.get('minFollowers')!) 
      : undefined;
    const maxFollowers = searchParams.get('maxFollowers')
      ? parseInt(searchParams.get('maxFollowers')!)
      : undefined;
    const sortBy = (searchParams.get('sortBy') || 'importance_score') as any;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const engagementType = searchParams.get('engagementType') as any;
    
    // Get tweet
    const tweet = await getTweetById(tweet_id);
    
    if (!tweet) {
      return NextResponse.json(
        { error: 'Tweet not found' },
        { status: 404 }
      );
    }
    
    // Get engagers with filters
    const engagers = await getEngagers(tweet_id, {
      limit,
      skip,
      minFollowers,
      maxFollowers,
      sortBy,
      sortOrder,
      engagementType,
    });
    
    // Get total count with same filters
    const totalCount = await getEngagerCount(tweet_id, minFollowers, maxFollowers);
    
    return NextResponse.json({
      success: true,
      data: {
        tweet,
        engagers,
        pagination: {
          limit,
          skip,
          count: engagers.length,
          total: totalCount,
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching tweet details:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch tweet details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

