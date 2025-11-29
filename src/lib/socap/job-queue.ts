import { Collection, ObjectId } from 'mongodb';
import clientPromise from '../mongodb';

// ===== TypeScript Interfaces =====

export interface Job {
  _id?: string;
  campaign_id: string;
  tweet_id: string;
  job_type: 'retweets' | 'replies' | 'quotes' | 'metrics';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  priority: number; // 1=metrics (highest), 2=retweets, 3=replies/quotes
  claimed_by: string | null; // worker instance ID
  claimed_at: Date | null;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  retry_after: Date | null; // When to retry (for exponential backoff)
  created_at: Date;
  updated_at: Date;
}

export interface EnqueueJobInput {
  campaign_id: string;
  tweet_id: string;
  job_type: Job['job_type'];
  priority?: number;
}

// ===== Collection Getter =====

export async function getJobQueueCollection(): Promise<Collection<Job>> {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<Job>('socap_job_queue');
}

// ===== Indexes =====

export async function createJobQueueIndexes(): Promise<void> {
  const collection = await getJobQueueCollection();
  
  // Index for efficient job claiming
  await collection.createIndex({ status: 1, priority: -1, created_at: 1 });
  
  // Unique constraint: one job per tweet/job_type combination
  await collection.createIndex(
    { campaign_id: 1, tweet_id: 1, job_type: 1 },
    { unique: true }
  );
  
  await collection.createIndex({ campaign_id: 1 });
  await collection.createIndex({ claimed_by: 1 });
}

// ===== Job Priority Mapping =====

function getJobPriority(jobType: Job['job_type']): number {
  const priorities: Record<Job['job_type'], number> = {
    metrics: 1, // Highest priority
    retweets: 2,
    replies: 3,
    quotes: 3,
  };
  return priorities[jobType];
}

// ===== CRUD Operations =====

/**
 * Enqueue a single job
 */
export async function enqueueJob(input: EnqueueJobInput): Promise<Job> {
  const collection = await getJobQueueCollection();
  
  const job: Job = {
    campaign_id: input.campaign_id,
    tweet_id: input.tweet_id,
    job_type: input.job_type,
    status: 'pending',
    priority: input.priority ?? getJobPriority(input.job_type),
    claimed_by: null,
    claimed_at: null,
    retry_count: 0,
    max_retries: 3, // Default max retries
    retry_after: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  
  // Use upsert to avoid duplicates
  // If job exists, reset it to pending (allows re-queuing for periodic runs)
  // If job doesn't exist, create new one
  const result = await collection.findOneAndUpdate(
    {
      campaign_id: input.campaign_id,
      tweet_id: input.tweet_id,
      job_type: input.job_type,
    },
    {
      $setOnInsert: job,
      $set: {
        status: 'pending', // Always reset to pending when enqueuing
        priority: job.priority,
        claimed_by: null, // Release any previous claim
        claimed_at: null,
        retry_count: 0, // Reset retry count
        retry_after: null,
        updated_at: new Date(),
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    }
  );
  
  if (!result) {
    throw new Error('Failed to enqueue job');
  }
  
  return result as Job;
}

/**
 * Enqueue jobs for all tweets in a campaign
 */
export async function enqueueCampaignJobs(campaignId: string): Promise<number> {
  const { getTweetsByCampaign } = await import('../models/socap/tweets');
  const tweets = await getTweetsByCampaign(campaignId);
  
  if (tweets.length === 0) {
    console.log(`No tweets found for campaign ${campaignId}`);
    return 0;
  }
  
  const jobTypes: Array<'retweets' | 'replies' | 'quotes' | 'metrics'> = [
    'retweets',
    'replies',
    'quotes',
    'metrics',
  ];
  
  let enqueued = 0;
  const skipped = 0;
  let errors = 0;
  
  console.log(`Enqueuing jobs for campaign ${campaignId}: ${tweets.length} tweets × ${jobTypes.length} job types = ${tweets.length * jobTypes.length} total jobs`);
  
  for (const tweet of tweets) {
    for (const jobType of jobTypes) {
      try {
        await enqueueJob({
          campaign_id: campaignId,
          tweet_id: tweet.tweet_id,
          job_type: jobType,
        });
        enqueued++;
      } catch (error) {
        errors++;
        // Log error details for debugging
        console.error(`Failed to enqueue job for campaign ${campaignId}, tweet ${tweet.tweet_id}, job ${jobType}:`, error);
      }
    }
  }
  
  console.log(`Campaign ${campaignId}: ${enqueued} jobs enqueued, ${skipped} skipped, ${errors} errors`);
  
  return enqueued;
}

/**
 * Claim a pending job (atomic operation)
 * Also claims jobs ready for retry
 */
export async function claimJob(workerId: string): Promise<Job | null> {
  const collection = await getJobQueueCollection();
  
  // First, reset jobs ready for retry
  const now = new Date();
  await collection.updateMany(
    {
      status: 'retrying',
      retry_after: { $lte: now },
    },
    {
      $set: {
        status: 'pending',
        retry_after: null,
        updated_at: new Date(),
      },
    }
  );
  
  // Claim a pending job (including newly reset retry jobs)
  const result = await collection.findOneAndUpdate(
    {
      status: 'pending',
    },
    {
      $set: {
        status: 'processing',
        claimed_by: workerId,
        claimed_at: new Date(),
        updated_at: new Date(),
      },
    },
    {
      sort: { priority: 1, created_at: 1 }, // Highest priority, oldest first
      returnDocument: 'after',
    }
  );
  
  return result as Job | null;
}

/**
 * Mark job as completed
 */
export async function completeJob(jobId: string): Promise<boolean> {
  const collection = await getJobQueueCollection();
  
  if (!ObjectId.isValid(jobId)) {
    return false;
  }
  
  const result = await collection.updateOne(
    { _id: new ObjectId(jobId) } as any,
    {
      $set: {
        status: 'completed',
        updated_at: new Date(),
      },
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Mark job as failed (with retry logic)
 */
export async function failJob(jobId: string, errorMessage: string): Promise<boolean> {
  const collection = await getJobQueueCollection();
  
  if (!ObjectId.isValid(jobId)) {
    return false;
  }
  
  // Get current job to check retry count
  const job = await collection.findOne({ _id: new ObjectId(jobId) } as any);
  
  if (!job) {
    return false;
  }
  
  const retryCount = (job.retry_count || 0) + 1;
  const maxRetries = job.max_retries || 3;
  
  // Check if we should retry
  if (retryCount < maxRetries) {
    // Calculate exponential backoff: 2^retryCount minutes
    const backoffMinutes = Math.pow(2, retryCount);
    const retryAfter = new Date(Date.now() + backoffMinutes * 60 * 1000);
    
    // Mark as retrying
    const result = await collection.updateOne(
      { _id: new ObjectId(jobId) } as any,
      {
        $set: {
          status: 'retrying',
          error_message: errorMessage,
          retry_count: retryCount,
          retry_after: retryAfter,
          claimed_by: null, // Release claim
          claimed_at: null,
          updated_at: new Date(),
        },
      }
    );
    
    console.log(`Job ${jobId} will retry (${retryCount}/${maxRetries}) after ${retryAfter.toISOString()}`);
    return result.modifiedCount > 0;
  } else {
    // Max retries exceeded, mark as permanently failed
    const result = await collection.updateOne(
      { _id: new ObjectId(jobId) } as any,
      {
        $set: {
          status: 'failed',
          error_message: errorMessage,
          retry_count: retryCount,
          updated_at: new Date(),
        },
      }
    );
    
    console.log(`Job ${jobId} permanently failed after ${retryCount} retries`);
    return result.modifiedCount > 0;
  }
}

/**
 * Reset job for retry (called when retry_after time has passed)
 */
export async function resetJobForRetry(jobId: string): Promise<boolean> {
  const collection = await getJobQueueCollection();
  
  if (!ObjectId.isValid(jobId)) {
    return false;
  }
  
  const result = await collection.updateOne(
    { _id: new ObjectId(jobId) } as any,
    {
      $set: {
        status: 'pending',
        retry_after: null,
        updated_at: new Date(),
      },
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Get jobs ready for retry
 */
export async function getJobsReadyForRetry(limit: number = 50): Promise<Job[]> {
  const collection = await getJobQueueCollection();
  const now = new Date();
  
  return await collection
    .find({
      status: 'retrying',
      retry_after: { $lte: now },
    })
    .limit(limit)
    .toArray();
}

/**
 * Get job queue statistics
 */
export async function getJobQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const collection = await getJobQueueCollection();
  
  const [pending, processing, completed, failed] = await Promise.all([
    collection.countDocuments({ status: 'pending' }),
    collection.countDocuments({ status: 'processing' }),
    collection.countDocuments({ status: 'completed' }),
    collection.countDocuments({ status: 'failed' }),
  ]);
  
  return { pending, processing, completed, failed };
}

/**
 * Clean up old completed jobs (optional maintenance)
 */
export async function cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
  const collection = await getJobQueueCollection();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  
  const result = await collection.deleteMany({
    status: 'completed',
    updated_at: { $lt: cutoffDate },
  });
  
  return result.deletedCount;
}

