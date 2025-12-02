import { Collection } from 'mongodb';
import clientPromise from '../../mongodb';

// ===== TypeScript Interfaces =====

export interface Engagement {
  _id?: string;
  campaign_id: string;
  tweet_id: string; // Original tweet being engaged with
  user_id: string;
  action_type: 'retweet' | 'reply' | 'quote';
  timestamp: Date;
  text?: string; // for replies/quotes
  engagement_tweet_id?: string; // ID of the actual quote/reply tweet (for quotes and replies)
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
  engagement_tweet_id?: string; // ID of the actual quote/reply tweet
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
    engagement_tweet_id: input.engagement_tweet_id,
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

/**
 * Get time-bucketed engagement counts for a campaign.
 *
 * This is the core of the "robust chart vs time" system:
 * we bucket by the actual engagement timestamp coming from the
 * Twitter API (or best approximation), not by when workers ran.
 */
export async function getEngagementTimeSeriesByCampaign(
  campaignId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    granularity?: 'hour' | 'day';
    action_type?: 'retweet' | 'reply' | 'quote';
    category?: 'main_twt' | 'influencer_twt' | 'investor_twt';
  }
): Promise<
  Array<{
    bucket_start: Date;
    retweets: number;
    replies: number;
    quotes: number;
    total: number;
  }>
> {
  const collection = await getEngagementsCollection();

  const match: any = {
    campaign_id: campaignId,
  };

  if (options?.startDate || options?.endDate) {
    match.timestamp = {};
    if (options.startDate) {
      match.timestamp.$gte = options.startDate;
    }
    if (options.endDate) {
      match.timestamp.$lte = options.endDate;
    }
  }

  if (options?.action_type) {
    match.action_type = options.action_type;
  }

  const pipeline: any[] = [
    { $match: match },
  ];

  // Optional join with tweets collection for category filtering
  if (options?.category) {
    pipeline.push(
      {
        $lookup: {
          from: 'socap_tweets',
          localField: 'tweet_id',
          foreignField: 'tweet_id',
          as: 'tweet',
        },
      },
      { $unwind: '$tweet' },
      {
        $match: {
          'tweet.category': options.category,
        },
      }
    );
  }

  const unit = options?.granularity === 'day' ? 'day' : 'hour';

  pipeline.push(
    {
      $group: {
        _id: {
          bucket_start: {
            $dateTrunc: {
              date: '$timestamp',
              unit,
            },
          },
        },
        retweets: {
          $sum: {
            $cond: [{ $eq: ['$action_type', 'retweet'] }, 1, 0],
          },
        },
        replies: {
          $sum: {
            $cond: [{ $eq: ['$action_type', 'reply'] }, 1, 0],
          },
        },
        quotes: {
          $sum: {
            $cond: [{ $eq: ['$action_type', 'quote'] }, 1, 0],
          },
        },
        total: { $sum: 1 },
      },
    },
    {
      $sort: {
        '_id.bucket_start': 1,
      },
    }
  );

  const results = await collection.aggregate(pipeline).toArray();

  return results.map((r: any) => ({
    bucket_start: r._id.bucket_start,
    retweets: r.retweets ?? 0,
    replies: r.replies ?? 0,
    quotes: r.quotes ?? 0,
    total: r.total ?? 0,
  }));
}

export async function getEngagementById(engagementId: string): Promise<Engagement | null> {
  const collection = await getEngagementsCollection();
  const { ObjectId } = await import('mongodb');
  
  if (!ObjectId.isValid(engagementId)) {
    return null;
  }
  
  return await collection.findOne({ _id: new ObjectId(engagementId) } as any);
}

