# Twitter API (twitterapi.io) Endpoint Usage

> **Quick Reference**: How we use each twitterapi.io endpoint, where, and at what cost.

---

## Pricing Summary

| Resource | Cost |
|----------|------|
| Tweets | $0.15 per 1K tweets |
| Profiles | $0.18 per 1K users |
| Followers/Following | $0.15 per 1K extracted |

---

## Endpoints Overview

| Endpoint | Page Size | Used For | Files |
|----------|-----------|----------|-------|
| `/twitter/tweets` | N/A (batch) | Fetch tweet metrics | `external-api.ts` |
| `/twitter/tweet/replies` | 20 | Get replies to a tweet | `twitter-api-client.ts` |
| `/twitter/tweet/quotes` | 20 | Get quote tweets | `twitter-api-client.ts`, `external-api.ts`, `quote-views-extractor.ts` |
| `/twitter/tweet/retweeters` | 100 | Get users who retweeted | `twitter-api-client.ts` |
| `/twitter/user/info` | N/A (single) | Get user profile | Scripts only |
| `/twitter/user/followings` | 200 | Get accounts a user follows | Scripts only |

---

## Detailed Endpoint Usage

### 1. `/twitter/tweets` — Fetch Tweet Metrics

**Purpose**: Get metrics (likes, retweets, replies, quotes, views) for specific tweets.

**Location**: `src/lib/external-api.ts`

**Functions**:
- `fetchTweetMetrics(tweetId)` — Returns metrics for one tweet
- `fetchTweetDetails(tweetId)` — Returns metrics + author info

**Configuration**:
```
Method: GET
URL: /twitter/tweets?tweet_ids={tweetId}
Timeout: 30 seconds
Retries: 1
```

**Called By**:
- `metrics-worker.ts` — Periodic metric snapshots for campaigns
- Tweet analysis flows

**Cost Impact**: 1 API call per tweet per metric refresh.

---

### 2. `/twitter/tweet/replies` — Fetch Tweet Replies

**Purpose**: Get all replies to a tweet, with author information.

**Location**: `src/lib/twitter-api-client.ts`

**Function**: `fetchTweetReplies(tweetId, options)`

**Configuration**:
```
Method: GET
URL: /twitter/tweet/replies?tweetId={tweetId}&cursor={cursor}
Page Size: 20 items
Default Max Pages: 50 (configurable)
Rate Limit Delay: 500ms between pages
```

**Called By**:
- `replies-worker.ts` — SOCAP campaign engagement tracking

**Pagination Behavior**:
| Mode | Pages Fetched | Issue |
|------|---------------|-------|
| Backfill (first run) | ALL pages | ✓ Correct |
| Delta (subsequent) | 1 page only | ⚠️ Misses items if >20 new |

**Cost Impact**: 
- Backfill: All replies fetched once
- Delta: Only 20 items per run (may miss engagements)

---

### 3. `/twitter/tweet/quotes` — Fetch Quote Tweets

**Purpose**: Get all quote tweets of a tweet, including view counts.

**Locations**: 
- `src/lib/twitter-api-client.ts` — Engagement tracking
- `src/lib/external-api.ts` — Metrics aggregation
- `src/lib/socap/quote-views-extractor.ts` — Total view calculation

**Functions**:
- `fetchTweetQuotes(tweetId, options)` — For engagement records
- `fetchTweetQuotesPage(tweetId, cursor)` — Single page fetch
- `fetchQuoteMetricsAggregate(tweetId, options)` — Sum all quote views
- `extractTotalQuoteTweetViews(tweetId)` — Standalone view extractor

**Configuration**:
```
Method: GET
URL: /twitter/tweet/quotes?tweetId={tweetId}&cursor={cursor}
Page Size: 20 items
Default Max Pages: 60 (configurable)
Rate Limit Delay: 500ms between pages
```

**Called By**:
- `quotes-worker.ts` — SOCAP engagement tracking
- `quote-views-extractor.ts` — Calculate total quote views

**Pagination Behavior**:
| Mode | Pages Fetched | Issue |
|------|---------------|-------|
| Backfill | ALL pages | ✓ Correct |
| Delta | 1 page only | ⚠️ Misses items if >20 new |
| Metrics Aggregate | ALL pages | ⚠️ Re-fetches everything every time |

**Cost Impact**: **HIGHEST COST ENDPOINT**
- Metrics aggregation fetches ALL quote tweets every run
- Quote views are mutable, so running totals don't work
- A tweet with 500 quotes = 25 pages = 500 items fetched repeatedly

---

### 4. `/twitter/tweet/retweeters` — Fetch Retweeters

**Purpose**: Get users who retweeted a tweet.

**Location**: `src/lib/twitter-api-client.ts`

**Function**: `fetchTweetRetweets(tweetId, options)`

**Configuration**:
```
Method: GET
URL: /twitter/tweet/retweeters?tweetId={tweetId}&cursor={cursor}
Page Size: 100 users
Default Max Pages: 75 (configurable)
Rate Limit Delay: 500ms between pages
```

**Called By**:
- `retweets-worker.ts` — SOCAP engagement tracking

**Pagination Behavior**:
| Mode | Pages Fetched | Notes |
|------|---------------|-------|
| Backfill | ALL pages | ✓ Correct |
| Delta | 1 page only | Checks against existing user_ids |

**Limitation**: API returns users only, no retweet timestamp. Un-retweets cannot be detected without full re-fetch.

**Cost Impact**: 
- Backfill: All retweeters fetched once
- Delta: Up to 100 users checked per run

---

### 5. `/twitter/user/info` — Fetch User Profile

**Purpose**: Get profile information for a single user.

**Location**: Scripts only (not in main app)
- `scripts/auto-sync-low-followers-local.ts`
- `scripts/auto-sync-followers-local-backend.ts`
- `scripts/auto-sync-low-followers.ts`

**Configuration**:
```
Method: GET
URL: /twitter/user/info?userName={username}
```

**Called By**: Manual sync scripts for ranker database

**Cost Impact**: $0.18 per 1K users (profiles pricing)

---

### 6. `/twitter/user/followings` — Fetch User's Following List

**Purpose**: Get list of accounts a user follows.

**Location**: Scripts only
- `scripts/auto-sync-followers-local-backend.ts`
- `scripts/auto-sync-low-followers-local.ts`

**Configuration**:
```
Method: GET
URL: /twitter/user/followings?userName={username}&cursor={cursor}
Page Size: 200 users
Max Requests: 500 (configurable)
Rate Limit Delay: 500ms between pages
```

**Called By**: Manual sync scripts for ranker "important people" database

**Cost Impact**: $0.15 per 1K followers extracted

---

## Configuration Reference

**File**: `src/lib/config/twitter-api-config.ts`

```typescript
{
  apiUrl: 'https://api.twitterapi.io',
  rateLimitDelay: 500,        // ms between paginated requests
  requestTimeout: 30000,      // 30 seconds
  maxRetries: 3,
  retryDelay: 2000,           // 2 seconds
  qpsLimit: 3,                // Queries per second (adjusts by account balance)
  maxPages: {
    replies: 50,
    retweets: 75,
    quotes: 60,
  }
}
```

**API Key Strategy**:
- `TWITTER_API_KEY_MONITOR` — Dedicated for monitoring (protected)
- `TWITTER_API_KEY_SHARED` — For batch operations
- `TWITTER_API_KEY` — Fallback for both

---

## What's Wrong and How to Fix It

---

### Problem 1: Re-fetching Old Data

**Currently:** Every time we check for quote tweets, we download ALL of them from the beginning. 

**Example:** 
- Monday 9am: Tweet has 100 quote tweets. We fetch all 100.
- Monday 10am: Tweet now has 105 quote tweets. We fetch all 105 again.
- Monday 11am: Tweet now has 108 quote tweets. We fetch all 108 again.

We keep paying to download the same 100 quotes over and over, just to find the few new ones.

**Fix:** Remember the newest quote tweet ID we saw. Next time, stop fetching as soon as we see that ID again. We only pay for new items.

**Example after fix:**
- Monday 9am: Fetch all 100 quotes. Remember "newest ID = 100".
- Monday 10am: Fetch page 1, see IDs 105, 104, 103, 102, 101, 100... Stop at 100. Only paid for 5 new items.
- Monday 11am: Fetch page 1, see IDs 108, 107, 106, 105... Stop at 105. Only paid for 3 new items.

**Cost savings:** ~95% reduction.

---

### Problem 2: Missing New Engagements

**Currently:** When checking for new items, we only look at the first page (20 items for quotes/replies).

**Example:**
- Our tweet goes viral. Between checks, 50 people quote tweeted it.
- We fetch page 1: See the newest 20 quotes.
- We never fetch page 2 or 3: The other 30 quotes are lost forever.

**Fix:** Keep fetching pages until we hit something we've already seen. If there are 50 new quotes, fetch 3 pages. If there are 5 new quotes, fetch 1 page and stop early.

---

### Problem 3: Quote Views Keep Changing

**Currently:** Quote tweet views grow over time. A quote with 1,000 views today might have 5,000 views tomorrow.

**The challenge:** We can't just track "new quotes" because old quotes also need their view counts updated.

**Fix:** Split into two separate jobs:

1. **Finding new quotes** (run frequently, cheap)
   - Just detect new quote tweets and save their IDs
   - Uses the watermark approach from Problem 1

2. **Updating view counts** (run less often, like every 6 hours)
   - Take all quote tweet IDs we already know
   - Use the `/twitter/tweets` endpoint to batch-fetch their current metrics
   - This is cheaper because we fetch by ID, not by paginating

---

### Problem 4: Ghost Retweets

**Currently:** If someone un-retweets, we have no way to know. They just disappear from the API response. Our database keeps showing them as retweeters.

**Fix options:**
1. Accept it — a few ghost retweets usually don't matter for analytics
2. Do a weekly cleanup — fetch all retweeters once a week, compare with database, remove the missing ones

**Recommendation:** Just accept it. The cost of constantly checking for un-retweets isn't worth it.

---

## Summary

| Problem | What's Happening | The Fix |
|---------|-----------------|---------|
| Re-fetching old data | Download all 500 quotes every hour | Remember last ID, only fetch new ones |
| Missing engagements | Only check 1 page, miss items if >20 new | Fetch pages until we hit known items |
| Stale view counts | Can't track views without re-fetching | Separate "find new quotes" from "update views" |
| Ghost retweets | Un-retweets stay in our database | Weekly cleanup or accept it |

---

## Worker Summary

| Worker | Endpoint Used | Backfill | Delta |
|--------|--------------|----------|-------|
| `metrics-worker.ts` | `/twitter/tweets` | N/A | Fetch metrics |
| `replies-worker.ts` | `/twitter/tweet/replies` | All pages | 1 page |
| `quotes-worker.ts` | `/twitter/tweet/quotes` | All pages | 1 page |
| `retweets-worker.ts` | `/twitter/tweet/retweeters` | All pages | 1 page |

---

## Files Quick Reference

| File | Endpoints Used |
|------|---------------|
| `src/lib/external-api.ts` | `/tweets`, `/tweet/quotes` |
| `src/lib/twitter-api-client.ts` | `/tweet/replies`, `/tweet/quotes`, `/tweet/retweeters` |
| `src/lib/socap/quote-views-extractor.ts` | `/tweet/quotes` |
| `src/lib/config/twitter-api-config.ts` | Configuration only |
| `scripts/auto-sync-*.ts` | `/user/info`, `/user/followings` |
