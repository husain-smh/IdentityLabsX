# SOCAP Campaign Monitoring System - Architecture Plan

## Route Structure

**Route Prefix**: `/socap/`

This is a completely separate feature module called SOCAP. All new APIs must be constructed under the `/socap/` route prefix. This keeps the campaign monitoring system isolated from existing endpoints and allows independent scaling and versioning.

---

## 1. Campaign Setup & Configuration

### 1.1 Campaign Creation API
**Endpoint**: `POST /socap/campaigns`

**Request Body**:
```json
{
  "launch_name": "Product Launch Q1 2025",
  "client_info": {
    "name": "Client Company",
    "email": "client@example.com"
  },
  "maintweets": [
    {
      "url": "https://twitter.com/user/status/123456"
    }
  ], 
  "influencer_twts": [
    {
      "url": "https://twitter.com/user/status/789012"
    }
  ],
  "investor_twts": [
    {
      "url": "https://twitter.com/user/status/345678"
    }
  ],
  "monitor_window": {
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-01-04T00:00:00Z" // typically 3 days
  },
  "alert_preferences": {
    "importance_threshold": 10, // minimum importance score to trigger alert (can be dynamic per job type)
    "channels": ["slack", "email"],
    "frequency_window_minutes": 30, // don't spam same alert within this window
    "alert_spacing_minutes": 20 // space out alerts from same run over this duration
  }
}
```

**Note on Alert Thresholds**: The `importance_threshold` can be dynamic and adjusted per campaign or even per tweet category (main vs influencer vs investor). This allows different sensitivity levels based on campaign goals.

**Process**:
- Resolve each tweet URL to extract `tweet_id` using Twitter API
- Validate tweet exists and is accessible
- Create campaign document in MongoDB `campaigns` collection
- Create tweet documents in `tweets` collection with:
  - `category: "main_twt"` for tweets from `maintweets` array
  - `category: "influencer_twt"` for tweets from `influencer_twts` array
  - `category: "investor_twt"` for tweets from `investor_twts` array
- Initialize `worker_state` entries for each tweet × action type (retweets, replies, quotes, metrics)
- Set campaign status to `active`

**Benefits of Separate Arrays**:
- Easy querying: `tweets.find({ campaign_id, category: "main_twt" })` gets all main tweets
- Clear separation for dashboard views (show main vs influencer vs investor separately)
- Different alert thresholds can be applied per category if needed

---

## 2. Worker Scheduler & Execution Model


### 2.1 Scheduler Cadence & N8N Integration

**Architecture**: N8N scheduled workflow → API endpoint → Job Queue → Workers

- **N8N Workflow**: Runs every 30 minutes, calls `POST /socap/workers/trigger` API
- **API Endpoint**: Receives trigger, enqueues jobs for all active campaigns
- **Job Queue**: Distributes 300 tweets × 4 jobs = 1,200 jobs across available workers
- **Scope**: Only processes campaigns with `status: "active"` and within monitor window
- **Job Types**: Each tweet has 4 independent jobs (retweets, replies, quotes, metrics)

### 2.1.1 Efficient Job Processing for 300+ Tweets

**Problem**: 300 tweets × 4 jobs = 1,200 jobs to process every 30 minutes

**Solution - Job Queue with Worker Pool**:

1. **Job Queue System** (recommend BullMQ or Bull):
   - Create `job_queue` collection or use Redis-based queue
   - When N8N triggers, API enqueues all jobs asynchronously (non-blocking)
   - Each job is a small document: `{ campaign_id, tweet_id, job_type, priority, created_at }`

2. **Worker Pool Architecture**:
   - Multiple worker instances (horizontal scaling)
   - Each worker picks up jobs from queue (FIFO or priority-based)
   - Workers process jobs in parallel (e.g., 10 workers × 5 concurrent jobs = 50 jobs simultaneously)
   - With 50 concurrent jobs: 1,200 jobs / 50 = ~24 minutes to complete (well within 30-minute window)

3. **Job Prioritization**:
   - Priority 1: Metrics jobs (fastest, most important for real-time dashboard)
   - Priority 2: Retweets (most common engagement)
   - Priority 3: Replies and Quotes (less frequent)

4. **Rate Limit Distribution**:
   - Workers respect API rate limits
   - If rate limit hit, job is re-queued with delay
   - Jobs are idempotent (safe to retry)

5. **Database Efficiency**:
   - Each job reads its own `worker_state` (no locking)
   - Bulk operations where possible (bulk upsert for engagements)
   - Indexes ensure fast lookups

**Example Flow**:
```
N8N (30min) → POST /socap/workers/trigger
  ↓
API enqueues 1,200 jobs (takes ~2 seconds, non-blocking)
  ↓
10 Worker instances pick up jobs
  ↓
Each worker processes 5 jobs concurrently
  ↓
All jobs complete in ~20-25 minutes
  ↓
Next N8N trigger in 30 minutes
```

**Alternative (Simpler)**: If queue system is too complex initially, use MongoDB as queue:
- `job_queue` collection with `status: "pending" | "processing" | "completed"`
- Workers poll for `status: "pending"` jobs
- Update status atomically to prevent duplicate processing

### 2.2 Worker Execution Flow

**For Each Active Campaign**:
1. Fetch campaign document
2. For each tweet in campaign:
   - Enqueue 4 jobs (one per engagement type)
   - Each job checks its own `worker_state` for last cursor and success time
   - Jobs run independently and can execute in parallel

**Job Types Per Tweet**:
- `retweets_worker`: Fetches retweeters
- `replies_worker`: Fetches replies
- `quotes_worker`: Fetches quote tweets
- `metrics_worker`: Fetches tweet metrics (likes, views, etc.)

---

## 3. Retweeter Worker - Detailed Logic

### 3.1 First Run (Backfill)
- Fetch retweeters endpoint with `cursor: null`
- Page through ALL results using cursor pagination
- Store every retweeter as engagement document
- Save final cursor in `worker_state.retweets_cursor`
- Mark `worker_state.retweets_last_success` timestamp

### 3.2 Subsequent Runs (Delta Detection)
- Start with stored cursor from `worker_state.retweets_cursor`
- Fetch first page (typically 100 items)
- Check each retweeter against existing engagements:
  - If `user_id` exists for this `tweet_id` → update `last_seen_at` timestamp
  - If new `user_id` → insert new engagement document
- **Stop Condition**: When we encounter a retweeter whose `last_seen_at` is newer than `worker_state.retweets_last_success`, we stop paging (all newer items already processed)
- **Delta Calculation**: If endpoint returns 76 retweeters and we had 56 stored, we process only the top 20 new ones (newest-first ordering)

### 3.3 Cursor Management
- Save cursor after each successful page
- If cursor expires (API returns error), reset cursor to `null` and re-backfill (deduplication via unique index prevents double-counting)

---

## 4. Replies & Quotes Workers

### 4.1 Replies Worker
- Uses `worker_state.replies_cursor` to track position
- Calls replies endpoint with stored cursor
- If API returns new cursor, save it and continue until `has_next_page: false`
- Each reply stored as engagement with `action_type: "reply"`
- Composite unique index on `(tweet_id, user_id, action_type)` prevents duplicates

### 4.2 Quotes Worker
- Identical logic to replies worker
- Uses `worker_state.quotes_cursor`
- Stores with `action_type: "quote"`

---

## 5. Metrics Worker

### 5.1 Execution Cadence
- Runs every 30 minutes per tweet
- Compares current metrics to last stored baseline

### 5.2 Delta Calculation
- Fetch current metrics: `{ likes, retweets, quotes, replies, views, bookmarks }`
- Load last stored metrics from `tweets.metrics` field
- Calculate delta: `new_count - old_count = delta_for_timeslice`
- Store new baseline back in `tweets.metrics`
- Store delta in time-series collection for charting

### 5.3 Rate Limit Handling
- If API returns rate limit error:
  - Set `worker_state.metrics_blocked_until` timestamp (current time + retry delay)
  - Store current baseline before error occurred
  - On next run, if still blocked, skip and retry later
  - Once unblocked, resume with stored baseline to compute accurate delta

---

## 6. Engagement Normalization & Classification

### 6.1 Data Structure Per Engagement
```typescript
{
  _id: ObjectId,
  campaign_id: string,
  tweet_id: string,
  user_id: string,
  action_type: "retweet" | "reply" | "quote",
  timestamp: Date,
  text?: string, // for replies/quotes
  account_profile: {
    username: string,
    name: string,
    bio?: string,
    location?: string,
    followers: number,
    verified: boolean
  },
  importance_score: number, // calculated from following_index
  last_seen_at: Date, // for delta detection
  created_at: Date
}
```

**Timeline & Plotting Capabilities**:

1. **Engagement Timestamp**: The `timestamp` field stores when the user actually engaged (from Twitter API). This allows:
   - Plotting engagements over time (hourly/daily charts)
   - Showing "when did this account engage?" in dashboard
   - Time-series analysis: "peak engagement hours"

2. **Cumulative Metrics Graph Across All Tweets**:
   - **Data Source**: Query `tweets` collection for all tweets in campaign
   - **Time-Series Collection**: Store metric snapshots in `metric_snapshots` collection:
     ```typescript
     {
       campaign_id: string,
       snapshot_time: Date, // hourly or daily
       total_likes: number, // sum across all tweets
       total_retweets: number,
       total_quotes: number,
       total_replies: number,
       total_views: number,
       tweet_breakdown: {
         main_twt: { likes, retweets, quotes, replies },
         influencer_twt: { likes, retweets, quotes, replies },
         investor_twt: { likes, retweets, quotes, replies }
       }
     }
     ```
   - **Calculation**: On each metrics worker run, aggregate current metrics from all campaign tweets and store snapshot
   - **Graph Query**: `GET /socap/campaigns/:id/metrics?granularity=hour` returns time-series data
   - **Frontend**: Chart.js or Recharts can plot cumulative line graph showing growth over time

3. **Engagement Timeline Per Account**:
   - Query: `engagements.find({ campaign_id, user_id }).sort({ timestamp: 1 })`
   - Shows: "This account engaged with main tweet at 10:00, influencer tweet at 14:30, investor tweet at 18:00"
   - Useful for understanding engagement patterns
```

### 6.2 Importance Score Calculation
- Reuse existing `following_index` collection from ranker system
- Lookup `user_id` in `following_index` collection
- Sum weights of all important people who follow this user
- Formula: `importance_score = Σ(weight of each important person following them)`

### 6.3 Account Classification
- Reuse `categorizeEngager()` function from existing system
- Categories: `founders`, `vcs`, `ai_creators`, `media`, `developers`, `c_level`, `yc_alumni`, `others`
- Classification based on bio keywords (same logic as single tweet report)

### 6.4 Sentiment Analysis
- **Deferred**: Will be added as separate service later
- For now, engagements stored without sentiment data

---

## 7. Database Schema & Indexes

### 7.1 Collections

**`campaigns` Collection**:
```typescript
{
  _id: ObjectId,
  launch_name: string,
  client_info: { name, email },
  status: "active" | "paused" | "completed",
  monitor_window: { start_date, end_date },
  alert_preferences: { 
    importance_threshold: number, // can be dynamic
    channels: string[],
    frequency_window_minutes: number,
    alert_spacing_minutes: number // default 20
  },
  created_at: Date,
  updated_at: Date
}
```

**`tweets` Collection**:
```typescript
{
  _id: ObjectId,
  campaign_id: string,
  tweet_id: string,
  tweet_url: string,
  category: "main_twt" | "influencer_twt" | "investor_twt",
  author_name: string,
  author_username: string,
  metrics: {
    likeCount: number,
    retweetCount: number,
    quoteCount: number,
    replyCount: number,
    viewCount: number,
    bookmarkCount: number,
    last_updated: Date
  },
  created_at: Date
}
```

**`engagements` Collection**:
```typescript
{
  _id: ObjectId,
  campaign_id: string,
  tweet_id: string,
  user_id: string,
  action_type: "retweet" | "reply" | "quote",
  timestamp: Date,
  text?: string,
  account_profile: { username, name, bio, location, followers, verified },
  importance_score: number,
  last_seen_at: Date,
  created_at: Date
}
```

**`worker_state` Collection**:
```typescript
{
  _id: ObjectId,
  campaign_id: string,
  tweet_id: string,
  job_type: "retweets" | "replies" | "quotes" | "metrics",
  last_success: Date,
  cursor: string | null,
  blocked_until: Date | null,
  last_error: string | null,
  retry_count: number,
  updated_at: Date
}
```

**`alert_queue` Collection**:
```typescript
{
  _id: ObjectId,
  campaign_id: string,
  engagement_id: ObjectId, // reference to engagements collection
  user_id: string,
  action_type: "retweet" | "reply" | "quote",
  importance_score: number,
  run_batch: string, // timestamp of worker run that detected this alert
  scheduled_send_time: Date, // when to actually send (distributed over 20 min)
  status: "pending" | "sent" | "skipped",
  sent_at: Date | null,
  created_at: Date
}
```

**`alert_history` Collection**:
```typescript
{
  _id: ObjectId,
  campaign_id: string,
  user_id: string,
  action_type: string,
  timestamp_hour: Date, // rounded to hour for deduplication
  sent_at: Date,
  channel: "slack" | "email"
}
```

**`metric_snapshots` Collection** (for cumulative graphs):
```typescript
{
  _id: ObjectId,
  campaign_id: string,
  snapshot_time: Date, // hourly or daily
  total_likes: number,
  total_retweets: number,
  total_quotes: number,
  total_replies: number,
  total_views: number,
  tweet_breakdown: {
    main_twt: { likes, retweets, quotes, replies },
    influencer_twt: { likes, retweets, quotes, replies },
    investor_twt: { likes, retweets, quotes, replies }
  }
}
```

### 7.2 Required Indexes

**`engagements` Collection**:
- Unique index: `{ tweet_id: 1, user_id: 1, action_type: 1 }` (prevents duplicates)
- Index: `{ campaign_id: 1, created_at: -1 }` (for campaign queries)
- Index: `{ tweet_id: 1, timestamp: -1 }` (for tweet-specific queries)
- Index: `{ importance_score: -1 }` (for alert filtering)

**`tweets` Collection**:
- Index: `{ campaign_id: 1 }` (for campaign queries)
- Index: `{ tweet_id: 1 }` (unique, for lookups)

**`campaigns` Collection**:
- Index: `{ status: 1, "monitor_window.end_date": 1 }` (for scheduler queries)

**`worker_state` Collection**:
- Unique index: `{ campaign_id: 1, tweet_id: 1, job_type: 1 }` (one state per job)
- Index: `{ blocked_until: 1 }` (for retry scheduling)

**`alert_queue` Collection**:
- Index: `{ status: 1, scheduled_send_time: 1 }` (for finding pending alerts to send)
- Index: `{ campaign_id: 1, run_batch: 1 }` (for batch management)
- Index: `{ engagement_id: 1 }` (for deduplication checks)

**`alert_history` Collection**:
- Unique index: `{ campaign_id: 1, user_id: 1, action_type: 1, timestamp_hour: 1 }` (prevents duplicate sends)
- Index: `{ campaign_id: 1, sent_at: -1 }` (for history queries)

**`metric_snapshots` Collection**:
- Index: `{ campaign_id: 1, snapshot_time: 1 }` (for time-series queries)
- Index: `{ campaign_id: 1, snapshot_time: -1 }` (for latest snapshot lookup)

---

## 8. Scaling to 400+ Tweets

### 8.1 Job Distribution
- Scheduler enqueues jobs independently (not a monolith)
- Each tweet × action type = separate job with own state
- Jobs can run in parallel across multiple workers
- MongoDB sharding: Use `campaign_id` as shard key (or `{ campaign_id: 1, tweet_id: 1 }` for finer distribution)

### 8.2 Worker Pool
- Horizontal scaling: Add more worker instances
- Each worker picks up jobs from queue
- No shared state between workers (all state in MongoDB)

### 8.3 Rate Limit Management
- Distribute API calls across time windows
- Use exponential backoff for rate limit errors
- Track API usage per campaign to avoid hitting limits

---

## 9. Delta Detection - Detailed Example

### Scenario: 56 → 76 Retweeters

**Initial State**:
- 56 retweeters stored in `engagements` collection
- `worker_state.retweets_last_success = 2025-01-01T10:00:00Z`
- `worker_state.retweets_cursor = "abc123"`

**API Call**:
- Fetch with cursor `"abc123"`
- Returns 76 retweeters (newest first)

**Processing**:
1. Iterate through retweeters (newest to oldest)
2. For each retweeter:
   - Check if `(tweet_id, user_id, "retweet")` exists
   - If exists: Update `last_seen_at` to current timestamp
   - If new: Insert new engagement document
3. **Stop Condition**: When we hit a retweeter with `last_seen_at > 2025-01-01T10:00:00Z`, stop (all newer items already processed)
4. Result: Only top 20 new retweeters processed, 56 existing ones just get timestamp update

**Why This Works**:
- Twitter API returns newest-first
- We process in order until we hit already-seen items
- Unique index prevents duplicate inserts
- `last_seen_at` tracks when we last saw this engagement

---

## 10. Multiple Engagements Per Account

### Scenario: Important Account Engages 3 Tweets

**Example**: Investor @important_account engages:
- Main tweet (retweet)
- Influencer tweet (reply)
- Investor tweet (quote)

**Storage**:
- 3 separate engagement documents (one per tweet)
- Each has unique `(tweet_id, user_id, action_type)` combination
- All linked to same `campaign_id`

**Aggregation Logic**:
- **Campaign-level deduplication**: When showing "unique accounts" chart, dedupe by `user_id` across all tweets
- **Per-tweet tracking**: Raw history keeps all 3 engagements so we can show "this account engaged with all 3 tweets"
- **Dashboard display**: Can show both "total engagements" (3) and "unique accounts" (1)

---

## 11. Aggregator Service

### 11.1 Cumulative Metrics Charts

**Data Storage**: Store snapshots in `metric_snapshots` collection on each metrics worker run

**Process**:
1. Metrics worker runs for all tweets in campaign
2. Aggregate current metrics: Sum `likes`, `retweets`, `quotes`, `replies`, `views` across all tweets
3. Store snapshot in `metric_snapshots` with:
   - `snapshot_time`: Current timestamp (rounded to hour or day based on granularity)
   - `total_*`: Sum across all tweets
   - `tweet_breakdown`: Separate totals for main_twt, influencer_twt, investor_twt
4. Dashboard API queries `metric_snapshots` for time-series data

**Query Example**:
```javascript
db.metric_snapshots.find({ 
  campaign_id: "...",
  snapshot_time: { $gte: start_date, $lte: end_date }
}).sort({ snapshot_time: 1 })
```

**Frontend Chart**: Line graph showing cumulative growth of likes, retweets, quotes, replies over time. Can show:
- Total across all tweets (single line)
- Breakdown by category (3 lines: main, influencer, investor)

### 11.2 Pie Chart - Account Categories
- Query `engagements` collection for campaign
- Deduplicate by `user_id` (one account = one entry regardless of how many tweets they engaged)
- Count accounts per category (using classification from `categorizeEngager()`)
- Categories: `investors`, `founders`, `ai_creators`, `developers`, `media`, `others`

### 11.3 Time Series Per Profile
- Group engagements by category and time granularity (hour or day)
- Count engagements per category per time slice
- Show trend over monitor window
- **Granularity Options**:
  - **Hourly**: Better for short campaigns (1-3 days), shows intraday patterns
  - **Daily**: Better for longer campaigns (7+ days), reduces data points
  - **API Parameter**: `GET /socap/campaigns/:id/profile-timeseries?granularity=hour|day`
- **Query Example** (hourly):
  ```javascript
  db.engagements.aggregate([
    { $match: { campaign_id: "..." } },
    { $group: {
        _id: {
          category: "$account_category",
          hour: { $dateTrunc: { date: "$timestamp", unit: "hour" } }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.hour": 1 } }
  ])
  ```

---

## 12. Dashboard API

### 12.1 Endpoints

**Get Campaign Dashboard**: `GET /socap/campaigns/:campaign_id/dashboard`
- Returns aggregated metrics, charts data, latest engagers
- Cached for 1 minute to reduce database load

**Get Latest Engagers**: `GET /socap/campaigns/:campaign_id/engagements?limit=50&sort=importance_score`
- Returns most recent or highest importance engagers
- Supports pagination

**Get Campaign Metrics**: `GET /socap/campaigns/:campaign_id/metrics?granularity=hour|day`
- Returns time-series metrics for charts

### 12.2 Caching Strategy
- Redis cache with 1-minute TTL for dashboard data
- Cache key: `socap:dashboard:{campaign_id}`
- Invalidate on new engagement or metric update

---

## 13. Alert Worker

### 13.1 Trigger Conditions
- New engagement with `importance_score >= alert_preferences.importance_threshold`
- Threshold can be dynamic:
  - Per campaign: `alert_preferences.importance_threshold`
  - Per tweet category: Different thresholds for main_twt vs influencer_twt vs investor_twt
  - Per action type: Higher threshold for retweets, lower for quotes (more valuable)
- Checks every 30 minutes (same as scheduler/N8N interval)

### 13.2 Alert Spacing & Batching Strategy

**Problem**: In nth run, there may be 50 alerts to send. In n+1th run (30 min later), there may be 50 more. We want to send all alerts from nth run but space them out over 20 minutes before next run.

**Solution - Alert Queue with Spacing**:

1. **Alert Queue Collection**:
   ```typescript
   {
     campaign_id: string,
     engagement_id: ObjectId,
     user_id: string,
     action_type: string,
     importance_score: number,
     run_batch: string, // "2025-01-01T10:00:00Z" - groups alerts from same run
     scheduled_send_time: Date, // when to actually send
     status: "pending" | "sent" | "skipped",
     sent_at: Date | null
   }
   ```

2. **Process Flow**:
   - **During Worker Run**: When new high-importance engagement detected, insert into `alert_queue` with:
     - `run_batch = current_timestamp` (rounded to 30-min interval)
     - `status = "pending"`
     - `scheduled_send_time = now + random(0, 20 minutes)` (distribute over 20 min window)
   
   - **Alert Sender Service**: Runs every 2-3 minutes, finds alerts where:
     - `status = "pending"`
     - `scheduled_send_time <= now`
     - Sends alert and updates `status = "sent"`, `sent_at = now`
   
   - **Deduplication Check**: Before sending, check `alert_history` to ensure we haven't sent same alert in last `frequency_window_minutes`

3. **Benefits**:
   - All alerts from nth run are sent within 20 minutes
   - Next run (n+1) starts at 30 minutes, giving 10-minute buffer
   - Alerts are spaced out (not spammy)
   - Can handle bursts of alerts gracefully

### 13.3 Deduplication
- Track sent alerts in `alert_history` collection
- Key: `{ campaign_id, user_id, action_type, timestamp_hour }`
- Don't send same alert within `frequency_window_minutes` (default 30 minutes)
- Check happens before inserting into `alert_queue` (prevents queue bloat)

### 13.4 Notification Channels
- **Slack**: Webhook URL configured per campaign
- **Email**: SMTP configuration, sends to `client_info.email`
- **Rate Limiting**: Respect channel rate limits (e.g., Slack: 1 message/second per webhook)

### 13.5 Alert Format
- **High Importance Engager**: "Investor @username (importance: 25) retweeted your main tweet"
- **Quote Tweet**: "Founder @username quote-tweeted your influencer tweet: [quote text snippet]"
- **Multi-Engagement**: If same account engages multiple tweets, batch: "Investor @username engaged with 3 tweets: main (retweet), influencer (reply), investor (quote)"

---

## 14. Error Handling & Resilience

### 14.1 Cursor Expiration
- If API returns cursor expired error:
  - Reset `worker_state.cursor = null`
  - Set `worker_state.retry_count += 1`
  - On next run, re-backfill from beginning
  - Unique index prevents duplicate engagements

### 14.2 API Rate Limits
- If rate limit hit:
  - Set `worker_state.blocked_until = now + retry_delay`
  - Store current baseline/metrics before error
  - Log error in `worker_state.last_error`
  - On next run, check `blocked_until` and skip if still blocked

### 14.3 Credit Exhaustion
- Same handling as rate limits
- Store last known metrics baseline
- When credits return, resume with stored baseline
- Delta calculation: `new_metrics - stored_baseline = accurate_delta`

### 14.4 Process Death Recovery
- All state stored in MongoDB `worker_state`
- On restart, workers read `last_success` and `cursor` from database
- Resume from exact point where process died
- No data loss due to checkpointing

---

## 15. Campaign Completion

### 15.1 End of Monitor Window
- Scheduler detects `monitor_window.end_date` has passed
- Triggers final report job

### 15.2 Report Generation
- Freeze all metrics (no more updates)
- Calculate total CPM savings (if applicable)
- Generate final aggregated report
- Archive raw events to cold storage (optional)

### 15.3 Status Update
- Set `campaign.status = "completed"`
- Scheduler stops polling this campaign
- Dashboard remains accessible for historical viewing

---

## 16. API Endpoint Summary

### Campaign Management
- `POST /socap/campaigns` - Create campaign
- `GET /socap/campaigns` - List campaigns
- `GET /socap/campaigns/:id` - Get campaign details
- `PATCH /socap/campaigns/:id` - Update campaign (pause/resume)
- `DELETE /socap/campaigns/:id` - Delete campaign

### Dashboard & Analytics
- `GET /socap/campaigns/:id/dashboard` - Get dashboard data
- `GET /socap/campaigns/:id/metrics` - Get time-series metrics
- `GET /socap/campaigns/:id/engagements` - Get engagements list
- `GET /socap/campaigns/:id/report` - Get final report

### Worker Management (Internal)
- `POST /socap/workers/trigger` - Trigger job processing (called by N8N every 30 min)
- `POST /socap/workers/run` - Manually trigger worker (admin)
- `GET /socap/workers/status` - Get worker health status
- `GET /socap/workers/queue` - Get job queue status (pending/processing counts)

---

## 17. Implementation Notes

### 17.1 Technology Stack
- **API Framework**: Next.js App Router (existing)
- **Database**: MongoDB (existing)
- **Queue System**: TBD (could use BullMQ, Bull, or simple cron)
- **Caching**: Redis (if available) or in-memory with TTL
- **Worker Execution**: Node.js background jobs or separate worker service

### 17.2 Reusing Existing Systems
- **Importance Scoring**: Reuse `following_index` collection and calculation logic
- **Account Classification**: Reuse `categorizeEngager()` function from `src/lib/analyze-engagers.ts`
- **Database Models**: Follow existing patterns from `src/lib/models/`

### 17.3 Key Differences from Single Tweet Report
- **Multi-tweet tracking**: One campaign tracks multiple tweets
- **Real-time monitoring**: Continuous polling vs one-time analysis
- **Delta detection**: Only process new engagements, not full re-analysis
- **Time-series metrics**: Track metrics over time, not just snapshot
- **Alerting**: Proactive notifications vs passive reporting
