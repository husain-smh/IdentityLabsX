import { NextRequest, NextResponse } from 'next/server';
import { getAllTweets } from '@/lib/models/tweets';

// GET - List all tweets (paginated)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    const tweets = await getAllTweets(limit, skip);
    
    return NextResponse.json({
      success: true,
      tweets,
      pagination: {
        limit,
        skip,
        returned: tweets.length,
      },
    });
    
  } catch (error) {
    console.error('Error fetching tweets:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch tweets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
