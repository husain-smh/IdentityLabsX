import { Collection, ObjectId } from 'mongodb';
import clientPromise from '../../mongodb';

// ===== TypeScript Interfaces =====

export interface Engagement {
  _id?: string;
  campaign_id: string;
  tweet_id: string;
  user_id: string;
  action_type: 'retweet' | 'reply' | 'quote';
  timestamp: Date;
  text?: string; // for replies/quotes
  account_profile: {
    username: string;
    name: string;
    bio?: string;
    location?: string;
    followers: number;
    verified: boolean;
  };
  importance_score: number;
  account_categories: string[]; // from categorizeEngager
  last_seen_at: Date;
  created_at: Date;
}

export interface EngagementInput {
  campaign_id: string;
  tweet_id: string;
  user_id: string;
  action_type: 'retweet' | 'reply' | 'quote';
  timestamp: Date;
  text?: string;
  account_profile: {
    username: string;
    name: string;
    bio?: string;
    location?: string;
    followers: number;
    verified: boolean;
  };
  importance_score: number;
  account_categories: string[];
}

// ===== Collection Getter =====

export async function getEngagementsCollection(): Promise<Collection<Engagement>> {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<Engagement>('socap_engagements');
}

// ===== Indexes =====

export async function createEngagementIndexes(): Promise<void> {
  const collection = await getEngagementsCollection();
  
  // Unique index prevents duplicates
  await collection.createIndex(
    { tweet_id: 1, user_id: 1, action_type: 1 },
    { unique: true }
  );
  
  await collection.createIndex({ campaign_id: 1, created_at: -1 });
  await collection.createIndex({ tweet_id: 1, timestamp: -1 });
  await collection.createIndex({ importance_score: -1 });
  await collection.createIndex({ campaign_id: 1, importance_score: -1 });
  await collection.createIndex({ user_id: 1, campaign_id: 1 });
  await collection.createIndex({ 'account_profile.username': 1 });
}

// ===== CRUD Operations =====

export async function createOrUpdateEngagement(input: EngagementInput): Promise<Engagement> {
  const collection = await getEngagementsCollection();
  
  // Prepare fields that should be updated on both insert and update
  const updateFields = {
    campaign_id: input.campaign_id,
    tweet_id: input.tweet_id,
    user_id: input.user_id,
    action_type: input.action_type,
    timestamp: input.timestamp,
    text: input.text,
    account_profile: input.account_profile,
    importance_score: input.importance_score,
    account_categories: input.account_categories,
    last_seen_at: new Date(), // Always update last_seen_at
  };
  
  const result = await collection.findOneAndUpdate(
    {
      tweet_id: input.tweet_id,
      user_id: input.user_id,
      action_type: input.action_type,
    },
    {
      $set: updateFields,
      $setOnInsert: {
        // Only set created_at when creating a new document
        created_at: input.timestamp,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    }
  );
  
  return result as Engagement;
}

export async function getEngagementsByCampaign(
  campaignId: string,
  options?: {
    limit?: number;
    offset?: number;
    sort?: 'importance_score' | 'timestamp';
    category?: 'main_twt' | 'influencer_twt' | 'investor_twt';
    action_type?: 'retweet' | 'reply' | 'quote';
    min_importance?: number;
  }
): Promise<Engagement[]> {
  const collection = await getEngagementsCollection();
  
  const query: any = { campaign_id: campaignId };
  
  // Filter by tweet category (need to join with tweets collection)
  if (options?.category) {
    // This will be handled in aggregation pipeline
  }
  
  if (options?.action_type) {
    query.action_type = options.action_type;
  }
  
  if (options?.min_importance) {
    query.importance_score = { $gte: options.min_importance };
  }
  
  const sortField = options?.sort === 'timestamp' ? 'timestamp' : 'importance_score';
  const sortOrder = -1; // Descending
  
  let cursor = collection.find(query).sort({ [sortField]: sortOrder });
  
  if (options?.offset) {
    cursor = cursor.skip(options.offset);
  }
  
  if (options?.limit) {
    cursor = cursor.limit(options.limit);
  }
  
  return await cursor.toArray();
}

export async function getEngagementsByTweet(tweetId: string): Promise<Engagement[]> {
  const collection = await getEngagementsCollection();
  return await collection.find({ tweet_id: tweetId }).sort({ timestamp: -1 }).toArray();
}

export async function getEngagementsByUser(
  campaignId: string,
  userId: string
): Promise<Engagement[]> {
  const collection = await getEngagementsCollection();
  return await collection
    .find({ campaign_id: campaignId, user_id: userId })
    .sort({ timestamp: 1 })
    .toArray();
}

export async function getEngagementCountByCampaign(campaignId: string): Promise<number> {
  const collection = await getEngagementsCollection();
  return await collection.countDocuments({ campaign_id: campaignId });
}

export async function getUniqueEngagersByCampaign(campaignId: string): Promise<number> {
  const collection = await getEngagementsCollection();
  const result = await collection.distinct('user_id', { campaign_id: campaignId });
  return result.length;
}

export async function getEngagementById(engagementId: string): Promise<Engagement | null> {
  const collection = await getEngagementsCollection();
  const { ObjectId } = await import('mongodb');
  
  if (!ObjectId.isValid(engagementId)) {
    return null;
  }
  
  return await collection.findOne({ _id: new ObjectId(engagementId) } as any);
}

