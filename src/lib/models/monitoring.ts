import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../mongodb-ranker';

// ===== TypeScript Interfaces =====

export interface MonitoringJob {
  _id?: ObjectId;
  tweet_id: string;           // Extracted from URL
  tweet_url: string;          // Original URL user provided
  status: 'active' | 'completed';  // Simple status
  started_at: Date;           // When monitoring started
  created_at: Date;
}

export interface MetricSnapshot {
  _id?: ObjectId;
  tweet_id: string;            // Reference to monitoring_job
  timestamp: Date;             // When this snapshot was taken
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  bookmarkCount: number;
  quoteViewSum: number;        // Sum of views across quote tweets at this time
  quoteTweetCount: number;     // Number of quote tweets counted at this time
}

// ===== Collection Helpers =====

export async function getMonitoringJobsCollection(): Promise<Collection<MonitoringJob>> {
  const db = await getDb();
  return db.collection<MonitoringJob>('monitoring_jobs');
}

export async function getMetricSnapshotsCollection(): Promise<Collection<MetricSnapshot>> {
  const db = await getDb();
  return db.collection<MetricSnapshot>('metric_snapshots');
}

// ===== Database Operations =====

/**
 * Create a new monitoring job
 */
export async function createMonitoringJob(
  tweetId: string,
  tweetUrl: string
): Promise<MonitoringJob> {
  const collection = await getMonitoringJobsCollection();
  
  const job: MonitoringJob = {
    tweet_id: tweetId,
    tweet_url: tweetUrl,
    status: 'active',
    started_at: new Date(),
    created_at: new Date(),
  };
  
  await collection.insertOne(job);
  return job;
}

/**
 * Get active monitoring jobs that are still within 24-hour window
 */
export async function getActiveMonitoringJobs(): Promise<MonitoringJob[]> {
  const collection = await getMonitoringJobsCollection();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Find jobs that are active and started within the last 24 hours
  return await collection
    .find({
      status: 'active',
      started_at: { $gte: twentyFourHoursAgo }
    })
    .toArray();
}

/**
 * Get all monitoring jobs (active and completed), sorted by most recent first
 */
export async function getAllMonitoringJobs(
  limit: number = 100,
  skip: number = 0
): Promise<MonitoringJob[]> {
  const collection = await getMonitoringJobsCollection();
  return await collection
    .find({})
    .sort({ started_at: -1 }) // Most recent first
    .limit(limit)
    .skip(skip)
    .toArray();
}

/**
 * Get monitoring job by tweet ID
 */
export async function getMonitoringJobByTweetId(tweetId: string): Promise<MonitoringJob | null> {
  const collection = await getMonitoringJobsCollection();
  return await collection.findOne({ tweet_id: tweetId });
}

/**
 * Mark monitoring job as completed
 */
export async function completeMonitoringJob(tweetId: string): Promise<void> {
  const collection = await getMonitoringJobsCollection();
  await collection.updateOne(
    { tweet_id: tweetId },
    { $set: { status: 'completed' } }
  );
}

/**
 * Stop monitoring job manually
 */
export async function stopMonitoringJob(tweetId: string): Promise<void> {
  await completeMonitoringJob(tweetId);
}

/**
 * Store a metric snapshot
 */
export async function storeMetricSnapshot(
  tweetId: string,
  metrics: {
    likeCount: number;
    retweetCount: number;
    replyCount: number;
    quoteCount: number;
    viewCount: number;
    bookmarkCount: number;
    quoteViewSum?: number;
    quoteTweetCount?: number;
  }
): Promise<MetricSnapshot> {
  const collection = await getMetricSnapshotsCollection();
  
  const snapshot: MetricSnapshot = {
    tweet_id: tweetId,
    timestamp: new Date(),
    ...metrics,
    quoteViewSum: metrics.quoteViewSum ?? 0,
    quoteTweetCount: metrics.quoteTweetCount ?? 0,
  };
  
  await collection.insertOne(snapshot);
  return snapshot;
}

/**
 * Get all snapshots for a tweet, sorted by timestamp
 */
export async function getMetricSnapshots(tweetId: string): Promise<MetricSnapshot[]> {
  const collection = await getMetricSnapshotsCollection();
  return await collection
    .find({ tweet_id: tweetId })
    .sort({ timestamp: 1 }) // Ascending order (oldest first)
    .toArray();
}

/**
 * Get monitoring job with snapshots
 */
export async function getMonitoringData(tweetId: string): Promise<{
  job: MonitoringJob | null;
  snapshots: MetricSnapshot[];
}> {
  const job = await getMonitoringJobByTweetId(tweetId);
  const snapshots = await getMetricSnapshots(tweetId);
  
  return { job, snapshots };
}

// ===== Index Creation =====
export async function createMonitoringIndexes(): Promise<void> {
  const jobsCollection = await getMonitoringJobsCollection();
  const snapshotsCollection = await getMetricSnapshotsCollection();
  
  // Monitoring jobs indexes
  await jobsCollection.createIndex({ tweet_id: 1 }, { unique: true });
  await jobsCollection.createIndex({ status: 1 });
  await jobsCollection.createIndex({ started_at: -1 });
  
  // Metric snapshots indexes
  await snapshotsCollection.createIndex({ tweet_id: 1 });
  await snapshotsCollection.createIndex({ tweet_id: 1, timestamp: 1 });
  await snapshotsCollection.createIndex({ timestamp: -1 });
  
  console.log('✅ Monitoring indexes created');
}

