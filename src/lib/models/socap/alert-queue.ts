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
}

// ===== CRUD Operations =====

export async function createAlert(input: CreateAlertInput): Promise<AlertQueue> {
  const collection = await getAlertQueueCollection();
  
  const alert: AlertQueue = {
    ...input,
    status: 'pending',
    sent_at: null,
    created_at: new Date(),
  };
  
  const result = await collection.insertOne(alert);
  alert._id = result.insertedId.toString();
  
  return alert;
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

export async function markAlertAsSkipped(alertId: string, reason?: string): Promise<boolean> {
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

