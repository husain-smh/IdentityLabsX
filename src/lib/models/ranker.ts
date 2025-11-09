import { Collection, Db } from 'mongodb';
import rankerDbPromise from '../mongodb-ranker';

// ===== TypeScript Interfaces =====

export interface ImportantPerson {
  _id?: string;
  username: string;
  user_id?: string; // Optional until first sync
  name?: string; // Optional until first sync
  last_synced?: Date | null;
  following_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FollowingIndexEntry {
  _id?: string;
  followed_username: string;
  followed_user_id: string;
  followed_by: FollowedByEntry[];
  importance_score: number;
  updated_at: Date;
}

export interface FollowedByEntry {
  username: string;
  user_id: string;
  name: string;
}

export interface EngagementRanking {
  _id?: string;
  tweet_id: string;
  ranked_engagers: RankedEngager[];
  analyzed_at: Date;
}

export interface RankedEngager {
  username: string;
  userId: string;
  name: string;
  bio?: string;
  followers?: number;
  verified?: boolean;
  replied?: boolean;
  retweeted?: boolean;
  quoted?: boolean;
  importance_score: number;
  followed_by: FollowedByEntry[];
}

export interface TwitterUser {
  username: string;
  user_id: string;
  name: string;
}

export interface EngagerInput {
  username: string;
  userId: string;
  name: string;
  bio?: string;
  followers?: number;
  verified?: boolean;
  replied?: boolean;
  retweeted?: boolean;
  quoted?: boolean;
}

// ===== Helper Functions =====

export async function getImportantPeopleCollection(): Promise<Collection<ImportantPerson>> {
  const db = await rankerDbPromise;
  return db.collection<ImportantPerson>('important_people');
}

export async function getFollowingIndexCollection(): Promise<Collection<FollowingIndexEntry>> {
  const db = await rankerDbPromise;
  return db.collection<FollowingIndexEntry>('following_index');
}

export async function getEngagementRankingsCollection(): Promise<Collection<EngagementRanking>> {
  const db = await rankerDbPromise;
  return db.collection<EngagementRanking>('engagement_rankings');
}

// ===== Database Operations =====

export async function addImportantPerson(username: string): Promise<ImportantPerson> {
  const collection = await getImportantPeopleCollection();
  
  const newPerson: ImportantPerson = {
    username: username.trim(),
    following_count: 0,
    is_active: true,
    last_synced: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  
  await collection.insertOne(newPerson);
  return newPerson;
}

export async function removeImportantPerson(username: string): Promise<boolean> {
  const collection = await getImportantPeopleCollection();
  
  const result = await collection.updateOne(
    { username },
    {
      $set: {
        is_active: false,
        updated_at: new Date(),
      },
    }
  );
  
  return result.modifiedCount > 0;
}

export async function getImportantPeople(page: number = 1, limit: number = 20): Promise<{ people: ImportantPerson[], total: number }> {
  const collection = await getImportantPeopleCollection();
  
  const skip = (page - 1) * limit;
  const people = await collection.find({ is_active: true })
    .sort({ username: 1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  
  const total = await collection.countDocuments({ is_active: true });
  
  return { people, total };
}

export async function updateFollowingIndex(
  importantPerson: TwitterUser,
  followingList: TwitterUser[]
): Promise<void> {
  const followingIndexCollection = await getFollowingIndexCollection();
  const importantPeopleCollection = await getImportantPeopleCollection();
  
  // Step 0: Update important person with user_id and name from N8N
  await importantPeopleCollection.updateOne(
    { username: importantPerson.username },
    {
      $set: {
        user_id: importantPerson.user_id,
        name: importantPerson.name,
        updated_at: new Date(),
      },
    }
  );
  
  // Step 1: Remove this important person from all their previous following relationships
  await followingIndexCollection.updateMany(
    { 'followed_by.user_id': importantPerson.user_id },
    {
      $pull: { followed_by: { user_id: importantPerson.user_id } },
    }
  );
  
  // Step 2: Recalculate importance scores for users that no longer have this person
  await followingIndexCollection.updateMany(
    {},
    [
      {
        $set: {
          importance_score: { $size: '$followed_by' },
        },
      },
    ]
  );
  
  // Step 3: Add/update entries for new following list
  for (const followedUser of followingList) {
    await followingIndexCollection.updateOne(
      {
        followed_user_id: followedUser.user_id,
      },
      {
        $addToSet: {
          followed_by: {
            username: importantPerson.username,
            user_id: importantPerson.user_id,
            name: importantPerson.name,
          },
        },
        $set: {
          followed_username: followedUser.username,
          followed_user_id: followedUser.user_id,
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );
  }
  
  // Step 4: Recalculate importance scores for all affected users
  await followingIndexCollection.updateMany(
    {},
    [
      {
        $set: {
          importance_score: { $size: '$followed_by' },
        },
      },
    ]
  );
  
  // Step 5: Update last_synced for the important person
  await importantPeopleCollection.updateOne(
    { user_id: importantPerson.user_id },
    {
      $set: {
        last_synced: new Date(),
        following_count: followingList.length,
        updated_at: new Date(),
      },
    }
  );
}

export async function rankEngagers(engagers: EngagerInput[]): Promise<RankedEngager[]> {
  const followingIndexCollection = await getFollowingIndexCollection();
  
  // Lookup each engager in the following index
  const userIds = engagers.map(e => e.userId);
  const indexEntries = await followingIndexCollection
    .find({ followed_user_id: { $in: userIds } })
    .toArray();
  
  // Create a map for quick lookup
  const indexMap = new Map<string, FollowingIndexEntry>();
  indexEntries.forEach(entry => {
    indexMap.set(entry.followed_user_id, entry);
  });
  
  // Build ranked engagers list with all metadata preserved
  const rankedEngagers: RankedEngager[] = engagers.map(engager => {
    const indexEntry = indexMap.get(engager.userId);
    
    return {
      username: engager.username,
      userId: engager.userId,
      name: engager.name,
      bio: engager.bio,
      followers: engager.followers,
      verified: engager.verified,
      replied: engager.replied,
      retweeted: engager.retweeted,
      quoted: engager.quoted,
      importance_score: indexEntry?.importance_score || 0,
      followed_by: indexEntry?.followed_by || [],
    };
  });
  
  // Sort by importance score descending
  rankedEngagers.sort((a, b) => b.importance_score - a.importance_score);
  
  return rankedEngagers;
}

export async function saveEngagementRanking(
  tweetId: string,
  rankedEngagers: RankedEngager[]
): Promise<void> {
  const collection = await getEngagementRankingsCollection();
  
  await collection.insertOne({
    tweet_id: tweetId,
    ranked_engagers: rankedEngagers,
    analyzed_at: new Date(),
  });
}

// ===== Index Creation =====
export async function createIndexes(): Promise<void> {
  const importantPeopleCollection = await getImportantPeopleCollection();
  const followingIndexCollection = await getFollowingIndexCollection();
  const engagementRankingsCollection = await getEngagementRankingsCollection();
  
  // Important people indexes
  await importantPeopleCollection.createIndex({ username: 1 }, { unique: true });
  await importantPeopleCollection.createIndex({ user_id: 1 }, { unique: true });
  await importantPeopleCollection.createIndex({ is_active: 1 });
  
  // Following index indexes (critical for performance)
  await followingIndexCollection.createIndex({ followed_user_id: 1 }, { unique: true });
  await followingIndexCollection.createIndex({ followed_username: 1 });
  await followingIndexCollection.createIndex({ importance_score: -1 });
  await followingIndexCollection.createIndex({ 'followed_by.user_id': 1 });
  
  // Engagement rankings indexes
  await engagementRankingsCollection.createIndex({ tweet_id: 1 });
  await engagementRankingsCollection.createIndex({ analyzed_at: -1 });
}

