# SOCAP Campaign Monitoring System - Implementation Plan

## Executive Summary

This document outlines a **phased, modular implementation plan** for building the SOCAP Campaign Monitoring System. The system will monitor 300+ tweets across multiple campaigns, processing 1,200+ jobs every 30 minutes with efficient delta detection and alerting.

**Key Design Principles:**
- **Modular Architecture**: Separate concerns into independent, testable modules
- **Incremental Delivery**: Build in phases, validate each phase before moving forward
- **Reuse Existing Systems**: Leverage `following_index`, `categorizeEngager()`, and existing MongoDB patterns
- **Scalability First**: Design for 300+ tweets from day one, but start simple
- **Error Resilience**: Handle rate limits, cursor expiration, and API failures gracefully

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    N8N Scheduler (30min)                    │
│              POST /socap/workers/trigger                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Job Queue System (MongoDB-based)                │
│  - Enqueues jobs for all active campaigns                   │
│  - 300 tweets × 4 job types = 1,200 jobs                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Worker Pool (Horizontal Scaling)                │
│  - 10 workers × 5 concurrent jobs = 50 parallel            │
│  - Processes: retweets, replies, quotes, metrics            │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Engagements │ │   Metrics    │ │   Alerts    │
│  Collection  │ │  Snapshots   │ │   Queue     │
└──────────────┘ └──────────────┘ └──────────────┘
        │              │              │
        └──────────────┼──────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Dashboard API (Cached, Real-time)              │
│  - Campaign metrics, engagement lists, charts              │
└─────────────────────────────────────────────────────────────┘
```

### Database Collections

1. **`campaigns`** - Campaign configuration and metadata
2. **`tweets`** - Tweet details and current metrics
3. **`engagements`** - All retweets, replies, quotes (normalized)
4. **`worker_state`** - Cursor tracking and job state per tweet/job
5. **`alert_queue`** - Pending alerts with scheduled send times
6. **`alert_history`** - Sent alerts for deduplication
7. **`metric_snapshots`** - Time-series metrics for charts

---

## Phase 1: Foundation & Core Infrastructure (Week 1-2)

**Goal**: Establish database schema, models, and basic campaign management APIs.

### 1.1 Database Schema & Models

**Files to Create:**
- `src/lib/models/socap/campaigns.ts` - Campaign model and operations
- `src/lib/models/socap/tweets.ts` - Tweet model for campaigns
- `src/lib/models/socap/engagements.ts` - Engagement model
- `src/lib/models/socap/worker-state.ts` - Worker state tracking
- `src/lib/models/socap/alert-queue.ts` - Alert queue model
- `src/lib/models/socap/alert-history.ts` - Alert history model
- `src/lib/models/socap/metric-snapshots.ts` - Metric snapshots model

**Key Operations:**
- Create indexes (unique, performance)
- CRUD operations for each collection
- Helper functions for common queries

**Implementation Notes:**
- Follow existing patterns from `src/lib/models/ranker.ts` and `src/lib/models/tweets.ts`
- Use MongoDB connection from `src/lib/mongodb.ts`
- Create indexes on creation, not at runtime

### 1.2 Campaign Management API

**Endpoints:**
- `POST /socap/campaigns` - Create campaign
- `GET /socap/campaigns` - List campaigns
- `GET /socap/campaigns/:id` - Get campaign details
- `PATCH /socap/campaigns/:id` - Update campaign (pause/resume)
- `DELETE /socap/campaigns/:id` - Delete campaign

**Files to Create:**
- `src/app/api/socap/campaigns/route.ts` - List/Create campaigns
- `src/app/api/socap/campaigns/[id]/route.ts` - Get/Update/Delete campaign

**Key Features:**
- URL validation and tweet ID extraction
- Campaign validation (monitor window, alert preferences)
- Status management (active/paused/completed)

### 1.3 Tweet URL Resolution

**Files to Create:**
- `src/lib/socap/tweet-resolver.ts` - Extract tweet IDs from URLs

**Implementation:**
- Parse Twitter URLs (twitter.com, x.com)
- Extract tweet_id from URL patterns
- Validate tweet exists via Twitter API
- Return tweet metadata (author, text, etc.)

**Reuse:**
- `src/lib/external-api.ts` - `fetchTweetDetails()` function

---

## Phase 2: Worker Infrastructure & Job Queue (Week 2-3)

**Goal**: Build job queue system and worker execution framework.

### 2.1 MongoDB-Based Job Queue

**Why MongoDB Queue (Not BullMQ/Bull):**
- No additional infrastructure (Redis not required)
- Simpler deployment (one less service)
- Atomic operations via MongoDB
- Good enough for 1,200 jobs every 30 minutes

**Files to Create:**
- `src/lib/socap/job-queue.ts` - Job queue operations

**Key Operations:**
- `enqueueJobs(campaignId)` - Enqueue all jobs for a campaign
- `dequeueJob()` - Atomically claim a pending job
- `completeJob(jobId)` - Mark job as completed
- `failJob(jobId, error)` - Mark job as failed with retry logic

**Job Document Structure:**
```typescript
{
  _id: ObjectId,
  campaign_id: string,
  tweet_id: string,
  job_type: "retweets" | "replies" | "quotes" | "metrics",
  status: "pending" | "processing" | "completed" | "failed",
  priority: number, // 1=metrics, 2=retweets, 3=replies/quotes
  claimed_by: string | null, // worker instance ID
  claimed_at: Date | null,
  created_at: Date,
  updated_at: Date
}
```

**Indexes:**
- `{ status: 1, priority: -1, created_at: 1 }` - For efficient job claiming
- `{ campaign_id: 1, tweet_id: 1, job_type: 1 }` - Unique constraint

### 2.2 Worker Trigger API

**Files to Create:**
- `src/app/api/socap/workers/trigger/route.ts` - Trigger job processing

**Implementation:**
- Find all active campaigns within monitor window
- For each campaign, enqueue 4 jobs per tweet
- Return summary (jobs enqueued, campaigns processed)
- Called by N8N every 30 minutes

**Error Handling:**
- Log errors but don't fail entire batch
- Continue processing other campaigns if one fails

### 2.3 Worker Execution Framework

**Files to Create:**
- `src/lib/socap/workers/base-worker.ts` - Base worker class
- `src/lib/socap/workers/retweets-worker.ts` - Retweets worker
- `src/lib/socap/workers/replies-worker.ts` - Replies worker
- `src/lib/socap/workers/quotes-worker.ts` - Quotes worker
- `src/lib/socap/workers/metrics-worker.ts` - Metrics worker
- `src/lib/socap/workers/worker-orchestrator.ts` - Manages worker pool

**Base Worker Pattern:**
```typescript
abstract class BaseWorker {
  abstract processJob(job: Job): Promise<void>;
  
  async execute(job: Job): Promise<void> {
    // Load worker_state
    // Check blocked_until
    // Call processJob()
    // Update worker_state (cursor, last_success)
    // Handle errors (rate limits, cursor expiration)
  }
}
```

**Worker Orchestrator:**
- Manages worker pool (configurable concurrency)
- Distributes jobs across workers
- Handles worker failures gracefully
- Logs progress and metrics

---

## Phase 3: Core Workers - Retweets, Replies, Quotes (Week 3-4)

**Goal**: Implement engagement workers with delta detection.

### 3.1 Retweets Worker

**Files:**
- `src/lib/socap/workers/retweets-worker.ts`

**Logic:**
1. **First Run (Backfill):**
   - Fetch all retweeters with `cursor: null`
   - Page through all results
   - Store each retweeter as engagement
   - Save final cursor in `worker_state`

2. **Subsequent Runs (Delta):**
   - Start with stored cursor
   - Fetch first page (100 items)
   - For each retweeter:
     - Check if `(tweet_id, user_id, "retweet")` exists
     - If exists: Update `last_seen_at`
     - If new: Insert engagement
   - **Stop Condition**: When we hit a retweeter with `last_seen_at > last_success`, stop
   - Update cursor and `last_success` timestamp

**Reuse:**
- `src/lib/external-api.ts` - Twitter API calls
- `src/lib/twitter-api-client.ts` - Rate limiting

### 3.2 Replies Worker

**Files:**
- `src/lib/socap/workers/replies-worker.ts`

**Logic:**
- Similar to retweets but uses replies endpoint
- Uses `worker_state.replies_cursor`
- Stores with `action_type: "reply"`
- Includes reply text in engagement document

### 3.3 Quotes Worker

**Files:**
- `src/lib/socap/workers/quotes-worker.ts`

**Logic:**
- Identical to replies worker
- Uses `worker_state.quotes_cursor`
- Stores with `action_type: "quote"`

### 3.4 Engagement Normalization

**Files:**
- `src/lib/socap/engagement-processor.ts` - Process and enrich engagements

**Operations:**
1. **Importance Score Calculation:**
   - Lookup `user_id` in `following_index` collection
   - Use existing `importance_score` field
   - Reuse: `src/lib/models/ranker.ts` - `getFollowingIndexCollection()`

2. **Account Classification:**
   - Call `categorizeEngager()` from `src/lib/analyze-engagers.ts`
   - Store categories in engagement document

3. **Profile Enrichment:**
   - Store account profile (username, name, bio, followers, verified)
   - From Twitter API response

---

## Phase 4: Metrics Worker & Time-Series (Week 4-5)

**Goal**: Track metrics over time and generate snapshots.

### 4.1 Metrics Worker

**Files:**
- `src/lib/socap/workers/metrics-worker.ts`

**Logic:**
1. Fetch current metrics from Twitter API
2. Load last stored baseline from `tweets.metrics`
3. Calculate delta: `new_count - old_count`
4. Update `tweets.metrics` with new baseline
5. Store snapshot in `metric_snapshots` collection

**Delta Calculation:**
- Handles rate limits gracefully (store baseline before error)
- Accurate delta even after API downtime

### 4.2 Metric Snapshots

**Files:**
- `src/lib/socap/metric-aggregator.ts` - Aggregate metrics across tweets

**Operations:**
- Sum metrics across all tweets in campaign
- Break down by category (main_twt, influencer_twt, investor_twt)
- Store hourly snapshots (or daily for longer campaigns)
- Enable time-series charting

---

## Phase 5: Alert System (Week 5-6)

**Goal**: Smart alerting with spacing and deduplication.

### 5.1 Alert Detection

**Files:**
- `src/lib/socap/alert-detector.ts` - Detect high-importance engagements

**Logic:**
- After engagement is stored, check `importance_score >= threshold`
- Check `alert_history` for recent sends (deduplication)
- If eligible, insert into `alert_queue` with:
  - `scheduled_send_time = now + random(0, 20 minutes)`
  - `run_batch = current_timestamp` (rounded to 30-min interval)

### 5.2 Alert Queue Processing

**Files:**
- `src/lib/socap/alert-sender.ts` - Process and send alerts
- `src/app/api/socap/alerts/process/route.ts` - API endpoint (called by cron)

**Implementation:**
- Runs every 2-3 minutes
- Finds alerts where `status = "pending"` and `scheduled_send_time <= now`
- Sends via configured channels (Slack, Email)
- Updates `status = "sent"` and records in `alert_history`

**Channels:**
- **Slack**: Webhook URL per campaign
- **Email**: SMTP to `client_info.email`

### 5.3 Alert Deduplication

**Logic:**
- Before sending, check `alert_history`:
  - `{ campaign_id, user_id, action_type, timestamp_hour }`
- Don't send if sent within `frequency_window_minutes` (default 30)
- Prevents spam for accounts that engage multiple tweets

---

## Phase 6: Dashboard & Analytics APIs (Week 6-7)

**Goal**: Build dashboard APIs with caching and aggregations.

### 6.1 Dashboard API

**Files:**
- `src/app/api/socap/campaigns/[id]/dashboard/route.ts`

**Returns:**
- Total metrics (likes, retweets, quotes, replies, views)
- Latest engagements (sorted by importance)
- Category breakdown (pie chart data)
- Campaign status and metadata

**Caching:**
- Redis or in-memory cache with 1-minute TTL
- Cache key: `socap:dashboard:{campaign_id}`
- Invalidate on new engagement or metric update

### 6.2 Metrics Time-Series API

**Files:**
- `src/app/api/socap/campaigns/[id]/metrics/route.ts`

**Query Parameters:**
- `granularity=hour|day` - Time granularity
- `start_date`, `end_date` - Date range

**Returns:**
- Time-series data from `metric_snapshots` collection
- Cumulative metrics over time
- Breakdown by tweet category

### 6.3 Engagements API

**Files:**
- `src/app/api/socap/campaigns/[id]/engagements/route.ts`

**Query Parameters:**
- `limit`, `offset` - Pagination
- `sort=importance_score|timestamp` - Sort order
- `category=main_twt|influencer_twt|investor_twt` - Filter by category
- `action_type=retweet|reply|quote` - Filter by action
- `min_importance=number` - Filter by importance score

**Returns:**
- Paginated engagement list
- Includes account profile, importance score, categories

---

## Phase 7: Frontend Dashboard (Week 7-8)

**Goal**: Build React dashboard for campaign monitoring.

### 7.1 Campaign List Page

**Files:**
- `src/app/socap/page.tsx` - List all campaigns
- `src/app/socap/components/CampaignList.tsx`

**Features:**
- Create new campaign button
- List active/paused/completed campaigns
- Quick stats per campaign

### 7.2 Campaign Detail Dashboard

**Files:**
- `src/app/socap/campaigns/[id]/page.tsx` - Campaign dashboard
- `src/app/socap/campaigns/[id]/components/Dashboard.tsx`
- `src/app/socap/campaigns/[id]/components/MetricsChart.tsx`
- `src/app/socap/campaigns/[id]/components/EngagementList.tsx`
- `src/app/socap/campaigns/[id]/components/CategoryPieChart.tsx`

**Features:**
- Real-time metrics (auto-refresh every 1 minute)
- Cumulative metrics chart (Recharts)
- Category breakdown pie chart
- Engagement list with filters
- Tweet-specific views

**Reuse:**
- Existing chart components from `src/app/tweets/[tweetId]/page.tsx`
- Recharts library (already in dependencies)

---

## Phase 8: Testing & Optimization (Week 8-9)

**Goal**: Test at scale, optimize performance, handle edge cases.

### 8.1 Load Testing

**Scenarios:**
- 300 tweets × 4 jobs = 1,200 jobs
- Measure: Job processing time, database load, API rate limits
- Optimize: Worker concurrency, batch sizes, indexes

### 8.2 Error Handling

**Test Cases:**
- Rate limit handling
- Cursor expiration
- API downtime
- Database connection failures
- Worker process crashes

### 8.3 Performance Optimization

**Areas:**
- Database query optimization
- Index tuning
- Caching strategy
- Worker pool sizing
- Batch operations

---

## Technical Decisions & Rationale

### 1. MongoDB Queue vs BullMQ/Bull

**Decision**: MongoDB-based queue

**Rationale:**
- No additional infrastructure (Redis not required)
- Simpler deployment and maintenance
- Atomic operations via MongoDB transactions
- Sufficient for 1,200 jobs every 30 minutes
- Can migrate to BullMQ later if needed

### 2. Worker Pool Architecture

**Decision**: Horizontal scaling with configurable concurrency

**Rationale:**
- Start with 10 workers × 5 concurrent = 50 parallel jobs
- Can scale horizontally (add more worker instances)
- Each worker is stateless (all state in MongoDB)
- Process completes in ~20-25 minutes (within 30-min window)

### 3. Delta Detection Strategy

**Decision**: Cursor-based with `last_seen_at` tracking

**Rationale:**
- Efficient: Only process new engagements
- Accurate: Handles edge cases (cursor expiration, API downtime)
- Scalable: Works for 1 engagement or 10,000 engagements
- Prevents duplicate processing via unique indexes

### 4. Alert Spacing

**Decision**: Queue-based with scheduled send times

**Rationale:**
- Distributes alerts over 20-minute window
- Prevents spam while ensuring all alerts are sent
- Handles bursts gracefully (50+ alerts in one run)
- Simple to implement and maintain

### 5. Caching Strategy

**Decision**: In-memory cache with 1-minute TTL (Redis optional)

**Rationale:**
- Dashboard data changes every 30 minutes (worker cadence)
- 1-minute cache reduces database load significantly
- Can upgrade to Redis later for multi-instance deployments
- Simple to implement initially

---

## Module Structure

```
src/
├── lib/
│   ├── models/
│   │   └── socap/
│   │       ├── campaigns.ts
│   │       ├── tweets.ts
│   │       ├── engagements.ts
│   │       ├── worker-state.ts
│   │       ├── alert-queue.ts
│   │       ├── alert-history.ts
│   │       └── metric-snapshots.ts
│   ├── socap/
│   │   ├── tweet-resolver.ts
│   │   ├── job-queue.ts
│   │   ├── engagement-processor.ts
│   │   ├── metric-aggregator.ts
│   │   ├── alert-detector.ts
│   │   ├── alert-sender.ts
│   │   └── workers/
│   │       ├── base-worker.ts
│   │       ├── retweets-worker.ts
│   │       ├── replies-worker.ts
│   │       ├── quotes-worker.ts
│   │       ├── metrics-worker.ts
│   │       └── worker-orchestrator.ts
├── app/
│   ├── api/
│   │   └── socap/
│   │       ├── campaigns/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── dashboard/
│   │       │       │   └── route.ts
│   │       │       ├── metrics/
│   │       │       │   └── route.ts
│   │       │       └── engagements/
│   │       │           └── route.ts
│   │       ├── workers/
│   │       │   ├── trigger/
│   │       │   │   └── route.ts
│   │       │   └── status/
│   │       │       └── route.ts
│   │       └── alerts/
│   │           └── process/
│   │               └── route.ts
│   └── socap/
│       ├── page.tsx
│       └── campaigns/
│           └── [id]/
│               └── page.tsx
```

---

## Dependencies & Environment Variables

### New Dependencies (if needed)
- None required initially (MongoDB, Next.js already available)
- Optional: `bullmq` or `bull` for advanced queue features (Phase 8+)
- Optional: `redis` for distributed caching (Phase 6+)

### Environment Variables
```env
# Existing
MONGODB_URI=...
TWITTER_API_KEY=...
TWITTER_API_URL=...

# New (optional)
SOCAP_WORKER_CONCURRENCY=5  # Jobs per worker
SOCAP_WORKER_POOL_SIZE=10   # Number of workers
SOCAP_ALERT_SLACK_WEBHOOK=...  # Per campaign or global
SOCAP_ALERT_EMAIL_SMTP=...     # SMTP config
```

---

## Risk Mitigation

### 1. Scale Risks

**Risk**: 1,200 jobs may not complete in 30 minutes

**Mitigation:**
- Start with smaller campaigns (10-20 tweets)
- Monitor job processing times
- Adjust worker pool size and concurrency
- Can reduce N8N frequency to 45 minutes if needed

### 2. Rate Limit Risks

**Risk**: Twitter API rate limits may be hit

**Mitigation:**
- Reuse existing rate limiting from `twitter-api-client.ts`
- Track API usage per campaign
- Implement exponential backoff
- Store baselines before errors (accurate delta calculation)

### 3. Data Consistency Risks

**Risk**: Duplicate engagements or missed engagements

**Mitigation:**
- Unique indexes on `(tweet_id, user_id, action_type)`
- Atomic job claiming (MongoDB findOneAndUpdate)
- Cursor tracking with expiration handling
- Idempotent operations (safe to retry)

### 4. Performance Risks

**Risk**: Database queries may be slow with large datasets

**Mitigation:**
- Proper indexes on all query patterns
- Pagination for large result sets
- Caching for dashboard APIs
- Batch operations where possible

---

## Success Metrics

### Phase 1-2 (Foundation)
- ✅ Campaigns can be created and managed
- ✅ Database schema and indexes created
- ✅ Job queue system operational

### Phase 3-4 (Workers)
- ✅ All 4 worker types functional
- ✅ Delta detection working correctly
- ✅ Metrics snapshots being stored

### Phase 5 (Alerts)
- ✅ High-importance engagements trigger alerts
- ✅ Alerts spaced out over 20 minutes
- ✅ Deduplication working correctly

### Phase 6-7 (Dashboard)
- ✅ Dashboard APIs returning data
- ✅ Frontend displaying metrics and engagements
- ✅ Real-time updates working

### Phase 8 (Scale)
- ✅ System handles 300+ tweets
- ✅ All jobs complete within 30 minutes
- ✅ No data loss or duplicates
- ✅ Error handling robust

---

## Next Steps

1. **Review this plan** with team
2. **Set up development environment** (MongoDB, Twitter API keys)
3. **Start Phase 1** - Database models and campaign APIs
4. **Iterate** - Build, test, validate each phase before moving forward
5. **Monitor** - Track performance metrics from day one

---

## Questions to Resolve

1. **N8N Integration**: Confirm N8N workflow setup and endpoint access
2. **Alert Channels**: Confirm Slack webhook and email SMTP configuration
3. **Worker Deployment**: Where will workers run? (Same server, separate service, serverless?)
4. **Monitoring**: What monitoring/observability tools are available?
5. **Testing Strategy**: Unit tests, integration tests, or manual testing?

---

## Conclusion

This phased approach allows for:
- **Incremental delivery** - Each phase delivers value
- **Early validation** - Test assumptions before building complex features
- **Risk mitigation** - Identify issues early
- **Team alignment** - Clear milestones and deliverables

**Estimated Timeline**: 8-9 weeks for full implementation
**Team Size**: 1-2 backend engineers, 1 frontend engineer (optional)

The modular design ensures each component can be built, tested, and deployed independently, making the system maintainable and scalable.

