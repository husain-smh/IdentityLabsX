import { Collection, ObjectId } from 'mongodb';
import clientPromise from '../../mongodb';

// ===== TypeScript Interfaces =====

export interface AlertQueue {
  _id?: string;
  campaign_id: string;
  engagement_id: string; // Reference to engagements collection
  user_id: string;
  action_type: 'retweet' | 'reply' | 'quote';
  importance_score: number;
  run_batch: string; // Timestamp of worker run (rounded to 30-min interval)
  scheduled_send_time: Date;
  status: 'pending' | 'sent' | 'skipped';
  sent_at: Date | null;
  created_at: Date;
}

export interface CreateAlertInput {
  campaign_id: string;
  engagement_id: string;
  user_id: string;
  action_type: 'retweet' | 'reply' | 'quote';
  importance_score: number;
  run_batch: string;
  scheduled_send_time: Date;
}

// ===== Collection Getter =====

export async function getAlertQueueCollection(): Promise<Collection<AlertQueue>> {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<AlertQueue>('socap_alert_queue');
}

// ===== Indexes =====

export async function createAlertQueueIndexes(): Promise<void> {
  const collection = await getAlertQueueCollection();
  
  await collection.createIndex({ status: 1, scheduled_send_time: 1 });
  await collection.createIndex({ campaign_id: 1, run_batch: 1 });
  await collection.createIndex({ engagement_id: 1 });
  await collection.createIndex({ created_at: -1 });
  // Ensure one alert per (campaign, engagement)
  await collection.createIndex(
    { campaign_id: 1, engagement_id: 1 },
    { unique: true }
  );
}

// ===== CRUD Operations =====

export async function createAlert(input: CreateAlertInput): Promise<AlertQueue> {
  const collection = await getAlertQueueCollection();
  const now = new Date();

  // Normalize engagement_id to string for consistency
  const engagementIdStr = String(input.engagement_id);

  // Idempotent creation: one alert per (campaign_id, engagement_id).
  // If an alert already exists for this engagement, we update key fields
  // (e.g. importance_score, run_batch, scheduled_send_time) but do not
  // create a second alert row.
  const result = await collection.findOneAndUpdate(
    {
      campaign_id: input.campaign_id,
      // Match both string and legacy ObjectId forms of engagement_id
      $or: [
        { engagement_id: engagementIdStr },
        // Some older alerts may have stored engagement_id as ObjectId
        ...(ObjectId.isValid(engagementIdStr)
          ? [{ engagement_id: new ObjectId(engagementIdStr) } as any]
          : []),
      ],
    },
    {
      $setOnInsert: {
        campaign_id: input.campaign_id,
        engagement_id: engagementIdStr,
        user_id: input.user_id,
        action_type: input.action_type,
        status: 'pending',
        sent_at: null,
        created_at: now,
      },
      $set: {
        // Always enforce string form going forward
        engagement_id: engagementIdStr,
        importance_score: input.importance_score,
        run_batch: input.run_batch,
        scheduled_send_time: input.scheduled_send_time,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    }
  );

  return result as AlertQueue;
}

export async function getPendingAlerts(limit: number = 50): Promise<AlertQueue[]> {
  const collection = await getAlertQueueCollection();
  const now = new Date();
  
  return await collection
    .find({
      status: 'pending',
      scheduled_send_time: { $lte: now },
    })
    .sort({ scheduled_send_time: 1 })
    .limit(limit)
    .toArray();
}

export async function markAlertAsSent(alertId: string): Promise<boolean> {
  const collection = await getAlertQueueCollection();
  
  if (!ObjectId.isValid(alertId)) {
    return false;
  }
  
  const result = await collection.updateOne(
    { _id: new ObjectId(alertId) } as any,
    {
      $set: {
        status: 'sent',
        sent_at: new Date(),
      },
    }
  );
  
  return result.modifiedCount > 0;
}

export async function markAlertAsSkipped(alertId: string, _reason?: string): Promise<boolean> {
  const collection = await getAlertQueueCollection();
  
  if (!ObjectId.isValid(alertId)) {
    return false;
  }
  
  const result = await collection.updateOne(
    { _id: new ObjectId(alertId) } as any,
    {
      $set: {
        status: 'skipped',
        sent_at: null,
      },
    }
  );
  
  return result.modifiedCount > 0;
}

export async function getAlertsByCampaignAndBatch(
  campaignId: string,
  runBatch: string
): Promise<AlertQueue[]> {
  const collection = await getAlertQueueCollection();

  return await collection
    .find({
      campaign_id: campaignId,
      run_batch: runBatch,
    })
    .sort({ scheduled_send_time: 1 })
    .toArray();
}

/**
 * Get alerts for a campaign (optionally filtered by status)
 * Used by UI to visualize which alerts were generated and how they are spaced.
 */
export async function getAlertsByCampaign(
  campaignId: string,
  options?: { status?: AlertQueue['status']; limit?: number }
): Promise<AlertQueue[]> {
  const collection = await getAlertQueueCollection();

  const query: any = { campaign_id: campaignId };
  if (options?.status) {
    query.status = options.status;
  }

  let cursor = collection
    .find(query)
    .sort({ scheduled_send_time: 1 });

  if (options?.limit) {
    cursor = cursor.limit(options.limit);
  }

  return await cursor.toArray();
}

/**
 * Get a single alert by ID
 * Helpful for one-off actions like manual “Send on Slack” from the UI.
 */
export async function getAlertById(alertId: string): Promise<AlertQueue | null> {
  const collection = await getAlertQueueCollection();

  if (!ObjectId.isValid(alertId)) {
    return null;
  }

  return await collection.findOne({ _id: new ObjectId(alertId) } as any);
}

