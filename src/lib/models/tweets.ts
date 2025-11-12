import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../mongodb-ranker';

// ===== TypeScript Interfaces =====

export interface Tweet {
  _id?: ObjectId;
  tweet_id: string;
  tweet_url: string;
  author_name: string;
  author_username?: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  total_engagers: number;
  engagers_above_10k: number;
  engagers_below_10k: number;
  created_at: Date;
  analyzed_at?: Date;
  error?: string;
}

export interface Engager {
  _id?: ObjectId;
  tweet_id: string; // Reference to tweet
  userId: string;
  username: string;
  name: string;
  bio?: string;
  location?: string;
  followers: number;
  verified: boolean;
  
  // Engagement types
  replied: boolean;
  retweeted: boolean;
  quoted: boolean;
  
  // Ranking data (filled after ranking job)
  importance_score?: number;
  followed_by?: string[]; // Array of important usernames
  
  created_at: Date;
}

export interface EngagerInput {
  userId: string;
  username: string;
  name: string;
  bio?: string;
  location?: string;
  followers: number;
  verified: boolean;
  replied: boolean;
  retweeted: boolean;
  quoted: boolean;
}

// ===== Collection Helpers =====

export async function getTweetsCollection(): Promise<Collection<Tweet>> {
  const db = await getDb();
  return db.collection<Tweet>('tweets');
}

export async function getEngagersCollection(): Promise<Collection<Engager>> {
  const db = await getDb();
  return db.collection<Engager>('engagers');
}

// ===== Database Operations =====

/**
 * Create a new tweet analysis entry
 */
export async function createTweet(
  tweetId: string,
  tweetUrl: string,
  authorName: string,
  authorUsername?: string
): Promise<Tweet> {
  const collection = await getTweetsCollection();
  
  const tweet: Tweet = {
    tweet_id: tweetId,
    tweet_url: tweetUrl,
    author_name: authorName,
    author_username: authorUsername,
    status: 'pending',
    total_engagers: 0,
    engagers_above_10k: 0,
    engagers_below_10k: 0,
    created_at: new Date(),
  };
  
  await collection.insertOne(tweet);
  return tweet;
}

/**
 * Store engagers for a tweet
 */
export async function storeEngagers(
  tweetId: string,
  engagers: EngagerInput[]
): Promise<void> {
  const collection = await getEngagersCollection();
  
  const engagerDocs: Engager[] = engagers.map(e => ({
    tweet_id: tweetId,
    userId: e.userId,
    username: e.username,
    name: e.name,
    bio: e.bio,
    location: e.location,
    followers: e.followers,
    verified: e.verified,
    replied: e.replied,
    retweeted: e.retweeted,
    quoted: e.quoted,
    created_at: new Date(),
  }));
  
  if (engagerDocs.length > 0) {
    await collection.insertMany(engagerDocs);
  }
  
  // Update tweet stats
  const tweetsCollection = await getTweetsCollection();
  const above10k = engagers.filter(e => e.followers >= 10000).length;
  const below10k = engagers.length - above10k;
  
  await tweetsCollection.updateOne(
    { tweet_id: tweetId },
    {
      $set: {
        total_engagers: engagers.length,
        engagers_above_10k: above10k,
        engagers_below_10k: below10k,
        status: 'analyzing',
      },
    }
  );
}

/**
 * Update tweet status
 */
export async function updateTweetStatus(
  tweetId: string,
  status: Tweet['status'],
  error?: string
): Promise<void> {
  const collection = await getTweetsCollection();
  
  const update: any = {
    status,
  };
  
  if (status === 'completed') {
    update.analyzed_at = new Date();
  }
  
  if (error) {
    update.error = error;
  }
  
  await collection.updateOne(
    { tweet_id: tweetId },
    { $set: update }
  );
}

/**
 * Update engagers with ranking data
 */
export async function updateEngagersWithRanking(
  tweetId: string,
  rankedEngagers: Array<{
    userId: string;
    importance_score: number;
    followed_by: string[];
  }>
): Promise<void> {
  const collection = await getEngagersCollection();
  
  // Bulk update operations
  const bulkOps = rankedEngagers.map(re => ({
    updateOne: {
      filter: { tweet_id: tweetId, userId: re.userId },
      update: {
        $set: {
          importance_score: re.importance_score,
          followed_by: re.followed_by,
        },
      },
    },
  }));
  
  if (bulkOps.length > 0) {
    await collection.bulkWrite(bulkOps);
  }
}

/**
 * Delete all engagers for a tweet (used for re-analysis)
 */
export async function deleteEngagersByTweetId(tweetId: string): Promise<number> {
  const collection = await getEngagersCollection();
  const result = await collection.deleteMany({ tweet_id: tweetId });
  return result.deletedCount;
}

/**
 * Get tweet by ID
 */
export async function getTweet(tweetId: string): Promise<Tweet | null> {
  const collection = await getTweetsCollection();
  return await collection.findOne({ tweet_id: tweetId });
}

/**
 * Get all tweets (paginated)
 */
export async function getAllTweets(
  limit = 50,
  skip = 0
): Promise<Tweet[]> {
  const collection = await getTweetsCollection();
  return await collection
    .find({})
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip)
    .toArray();
}

/**
 * Get engagers for a tweet (paginated, filtered, sorted)
 */
export interface GetEngagersOptions {
  limit?: number;
  skip?: number;
  minFollowers?: number;
  maxFollowers?: number;
  sortBy?: 'followers' | 'importance_score' | 'username';
  sortOrder?: 'asc' | 'desc';
  engagementType?: 'replied' | 'retweeted' | 'quoted';
  verifiedOnly?: boolean;
}

export async function getEngagers(
  tweetId: string,
  options: GetEngagersOptions = {}
): Promise<{ engagers: Engager[]; total: number }> {
  const collection = await getEngagersCollection();
  
  const {
    limit = 50,
    skip = 0,
    minFollowers,
    maxFollowers,
    sortBy = 'importance_score',
    sortOrder = 'desc',
    engagementType,
    verifiedOnly,
  } = options;
  
  // Build filter
  const filter: any = { tweet_id: tweetId };
  
  if (minFollowers !== undefined) {
    filter.followers = { ...filter.followers, $gte: minFollowers };
  }
  
  if (maxFollowers !== undefined) {
    filter.followers = { ...filter.followers, $lte: maxFollowers };
  }
  
  if (engagementType) {
    filter[engagementType] = true;
  }
  
  if (verifiedOnly) {
    filter.verified = true;
  }
  
  // Build sort
  const sort: any = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  // Get total count
  const total = await collection.countDocuments(filter);
  
  // Get engagers
  const engagers = await collection
    .find(filter)
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .toArray();
  
  return { engagers, total };
}

/**
 * Get engagers count by follower ranges
 */
export async function getEngagersStats(tweetId: string): Promise<{
  total: number;
  above_10k: number;
  below_10k: number;
  replied: number;
  retweeted: number;
  quoted: number;
  verified: number;
  avg_importance_score: number;
  max_importance_score: number;
}> {
  const collection = await getEngagersCollection();
  
  const total = await collection.countDocuments({ tweet_id: tweetId });
  const above_10k = await collection.countDocuments({ tweet_id: tweetId, followers: { $gte: 10000 } });
  const below_10k = total - above_10k;
  const replied = await collection.countDocuments({ tweet_id: tweetId, replied: true });
  const retweeted = await collection.countDocuments({ tweet_id: tweetId, retweeted: true });
  const quoted = await collection.countDocuments({ tweet_id: tweetId, quoted: true });
  const verified = await collection.countDocuments({ tweet_id: tweetId, verified: true });
  
  // Calculate importance score stats
  const engagers = await collection
    .find({ tweet_id: tweetId, importance_score: { $exists: true } })
    .toArray();
  
  const scores = engagers
    .map(e => e.importance_score || 0)
    .filter(s => s > 0);
  
  const avg_importance_score = scores.length > 0
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length
    : 0;
  
  const max_importance_score = scores.length > 0
    ? Math.max(...scores)
    : 0;
  
  return {
    total,
    above_10k,
    below_10k,
    replied,
    retweeted,
    quoted,
    verified,
    avg_importance_score: Math.round(avg_importance_score * 100) / 100,
    max_importance_score,
  };
}

// ===== Index Creation =====
export async function createTweetsIndexes(): Promise<void> {
  const tweetsCollection = await getTweetsCollection();
  const engagersCollection = await getEngagersCollection();
  
  // Tweets indexes
  await tweetsCollection.createIndex({ tweet_id: 1 }, { unique: true });
  await tweetsCollection.createIndex({ status: 1 });
  await tweetsCollection.createIndex({ created_at: -1 });
  
  // Engagers indexes
  await engagersCollection.createIndex({ tweet_id: 1 });
  await engagersCollection.createIndex({ tweet_id: 1, userId: 1 }, { unique: true });
  await engagersCollection.createIndex({ followers: -1 });
  await engagersCollection.createIndex({ importance_score: -1 });
  await engagersCollection.createIndex({ username: 1 });
  
  console.log('✅ Tweets indexes created');
}

