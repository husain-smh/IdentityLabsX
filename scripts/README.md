# Scripts Guide

Standalone SOCAP/ranker utilities you can run with `npx tsx scripts/<file> ...` unless otherwise noted.

## 🔧 Setup (once)
- Node 18+ with native `fetch`.
- `npm install` (repo root).
- `.env` with: `MONGODB_URI` (both ranker & socap DBs), `TWITTER_API_KEY` (+ optional `TWITTER_API_URL`), `NEXT_PUBLIC_BASE_URL`, `AUTO_SYNC_BASE_URL` (defaults to `http://localhost:3000`), `OPENAIAPIKEY` for LLM scans.
- Optional: `REQUEST_INTERVAL_MS`, `MAX_PAGES`, etc. to tune rate limits (see individual scripts).

## 📚 Script reference

### Data ingestion & aggregation
- `aggregate-quote-metrics.ts` — Fetches quote tweets for campaign tweets and sums quote metrics into parent tweets. Args: `--campaign <id>`; optional `--category main|influencer|investor|all`, `--tweet <id>`, `--maxPages N` (default 60), `--intervalMs 500`. Run: `npx tsx scripts/aggregate-quote-metrics.ts --campaign <id>`.
- `aggregate-nested-quote-metrics.ts` — Fetches quotes-of-quotes for stored quote tweets and updates nested metrics. Args: `--campaign <id>`; optional `--quote <quoteTweetId>`, `--maxPages N`, `--intervalMs ms`. Run: `npx tsx scripts/aggregate-nested-quote-metrics.ts --campaign <id>`.
- `fetch-replies-logged.ts` — Logs and ingests replies for campaign tweets into engagements/replies collections. Args: `--campaign <id>`; optional `--category main|influencer|investor|all`, `--tweet <id>`, `--maxPages`, `--intervalMs`. Run: `npx tsx scripts/fetch-replies-logged.ts --campaign <id>`.
- `fetch-nested-quotes-logged.ts` — Logs and ingests quotes-of-quotes for campaign quote tweets into nested quote collection. Args: `--campaign <id>`; optional `--parent <quoteTweetId>`, `--maxPages`, `--intervalMs`. Run: `npx tsx scripts/fetch-nested-quotes-logged.ts --campaign <id>`.
- `populate-second-order-engagements.ts` — For each quote tweet in a campaign, fetches its retweets/replies and stores “second-order” engagements. Args: `--campaign <id>`; env: `SECOND_ORDER_MAX_PAGES` (default 10), `SECOND_ORDER_REQUEST_INTERVAL_MS` (default 500). Run: `npx tsx scripts/populate-second-order-engagements.ts --campaign <id>`.

### Narrative / LLM scans
- `narrative-scan.ts` — LLM-filters quote tweets for a campaign and writes a JSON report. Args: `--campaign-id <id>`; optional `--batch-size`, `--max-quotes`, `--output <file>`. Env: `OPENAIAPIKEY`. Run: `npx tsx scripts/narrative-scan.ts --campaign-id <id>`.
- `nested-narrative-scan.ts` — Same as above but for nested quote tweets. Args: `--campaign-id <id>`; optional `--batch-size`, `--max-quotes`, `--output`. Env: `OPENAIAPIKEY`. Run: `npx tsx scripts/nested-narrative-scan.ts --campaign-id <id>`.
- `reply-narrative-scan.ts` — LLM-filters replies for a campaign and writes a JSON report. Args: `--campaign-id <id>`; optional `--batch-size`, `--max-replies`, `--output`. Env: `OPENAIAPIKEY`. Run: `npx tsx scripts/reply-narrative-scan.ts --campaign-id <id>`.

### Sync & data hygiene (ranker)
- `auto-sync-low-followers.ts` — Finds unsynced `important_people` with following count ≤6000 via twitterapi.io, then calls `/api/ranker/admin/sync-person`. Env: `MONGODB_URI`, `TWITTER_API_KEY`, `AUTO_SYNC_BASE_URL` (default `http://localhost:3000`). Run: `npx tsx scripts/auto-sync-low-followers.ts`.
- `auto-sync-low-followers-local.ts` — Directly pages followings (up to threshold 10k by default) and posts cleaned list to `/api/ranker/sync/following`; supports `--username` to force one user. Env: `TWITTER_API_KEY`, `AUTO_SYNC_BASE_URL`, `REQUEST_INTERVAL_MS` (default 750), `MAX_REQUESTS` (default 3000). Run: `npx tsx scripts/auto-sync-low-followers-local.ts [--username <handle>]`.
- `auto-sync-followers-local-backend.ts` — Single-user sync helper that pages followings locally and posts to `/api/ranker/sync/following`. Args: `--username <handle>`; env: `TWITTER_API_KEY`, `AUTO_SYNC_BASE_URL`, `REQUEST_INTERVAL_MS` (default 500), `MAX_REQUESTS` (default 500). Run: `npx tsx scripts/auto-sync-followers-local-backend.ts --username <handle>`.
- `cleanup-malformed-usernames.ts` — Deletes `important_people` rows whose `username` contains commas (malformed bulk adds). **Destructive**; no args. Run: `npx tsx scripts/cleanup-malformed-usernames.ts`.

### Alerts & campaign maintenance
- `mark-invalid-alerts.ts` — Marks alerts as skipped when their engagement’s tweet_id is not in the campaign. Args: `<campaign-id>` or `--all`. Run: `npx tsx scripts/mark-invalid-alerts.ts <campaign-id>` or `--all`.
- `regenerate-alerts.ts` — Re-runs alert detection for a campaign via `detectAndQueueAlerts`. Args: `<campaign-id>`. Run: `npx tsx scripts/regenerate-alerts.ts <campaign-id>`.

### Worker & scheduling
- `socap-worker.ts` — Long-running worker that pulls and processes SOCAP jobs. Env: `SOCAP_WORKER_CONCURRENCY` (default 5), `SOCAP_MAX_JOBS_PER_BATCH` (default 100) plus DB/API envs. Run: `npm run worker` or `npx tsx scripts/socap-worker.ts` (keep process alive, e.g., PM2/systemd).
- `turbo-worker.ts` — **High-performance worker for processing large job backlogs quickly.** 3× faster than the regular worker with progress tracking, ETA display, and automatic stats. Env: `SOCAP_TURBO_CONCURRENCY` (default 15), `SOCAP_MAX_JOBS_PER_BATCH` (default 500), `SOCAP_TURBO_DELAY` (default 100ms). Run: `npm run turbo-worker` or with custom concurrency: `npx tsx scripts/turbo-worker.ts --concurrency=25`. **Campaign-specific processing:** `npx tsx scripts/turbo-worker.ts --campaign=<campaign_id>` — processes ONLY jobs for that campaign, ignoring all others.
- `job-scheduler.ts` — Cron scheduler that hits SOCAP endpoints to enqueue/run workers. Env: `NEXT_PUBLIC_BASE_URL` (defaults to `https://identity-labs-x.vercel.app`). Run: `npx tsx scripts/job-scheduler.ts` (or `npm run scheduler`). PM2 example: `pm2 start scripts/job-scheduler.ts --interpreter=node --interpreter-args="--loader tsx"`.

Default schedule inside `job-scheduler.ts`:
| Job | Endpoint | Interval | Purpose |
|---|---|---|---|
| Create Jobs | `/api/socap/workers/trigger` | */15 * * * * | Enqueue jobs for active campaigns |
| Process Jobs | `/api/socap/workers/run` | */5 * * * * | Process queued jobs |

To change or add jobs, edit the `JOBS` array in `job-scheduler.ts` (cron syntax such as `*/5 * * * *` for every 5 minutes). Keep Node 18+ so `fetch` is available.

