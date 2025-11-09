import { NextRequest, NextResponse } from 'next/server';
import { updateFollowingIndex, getImportantPeopleCollection } from '@/lib/models/ranker';

// POST - Receive following data from N8N and update inverse index
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, user_id, following_list } = body;

    // Validation
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'username is required and must be a string' },
        { status: 400 }
      );
    }

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json(
        { error: 'user_id is required and must be a string' },
        { status: 400 }
      );
    }

    if (!Array.isArray(following_list)) {
      return NextResponse.json(
        { error: 'following_list is required and must be an array' },
        { status: 400 }
      );
    }

    // Verify this person is in our important people list
    const collection = await getImportantPeopleCollection();
    const importantPerson = await collection.findOne({
      user_id: user_id,
      is_active: true,
    });

    if (!importantPerson) {
      return NextResponse.json(
        { error: 'This user is not in the important people list or is inactive' },
        { status: 404 }
      );
    }

    // Validate following_list items
    for (const user of following_list) {
      if (!user.username || !user.user_id) {
        return NextResponse.json(
          { error: 'Each user in following_list must have username and user_id' },
          { status: 400 }
        );
      }
    }

    // Prepare the important person object
    const importantPersonObj = {
      username: importantPerson.username,
      user_id: importantPerson.user_id,
      name: importantPerson.name,
    };

    // Process the following list
    const followingListObj = following_list.map((user: any) => ({
      username: user.username.trim(),
      user_id: user.user_id.trim(),
      name: user.name ? user.name.trim() : user.username.trim(),
    }));

    // Update the inverse index
    console.log(`Starting sync for ${username}: ${followingListObj.length} following`);
    await updateFollowingIndex(importantPersonObj, followingListObj);
    console.log(`Completed sync for ${username}`);

    return NextResponse.json({
      success: true,
      message: 'Following data synced successfully',
      data: {
        username: importantPerson.username,
        synced_at: new Date(),
        following_count: followingListObj.length,
        processed: followingListObj.length,
      },
    });

  } catch (error) {
    console.error('Error syncing following data:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to sync following data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

