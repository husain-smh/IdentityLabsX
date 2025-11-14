# Tweet Monitoring System - Setup Guide

## Overview
This system monitors tweet engagement metrics (likes, retweets, replies, quotes, views, bookmarks) every 30 minutes for 24 hours after a tweet URL is submitted.

## Prerequisites
- MongoDB database (already set up)
- N8N instance (already set up)
- Twitter API key from `api.twitterapi.io`

## Setup Steps

### 1. Install Dependencies
```bash
cd ilpdts
npm install
```

This will install `recharts` for the charting library.

### 2. Environment Variables
Add to your `.env` file:
```env
TWITTER_API_KEY=your_api_key_here
TWITTER_API_URL=https://api.twitterapi.io  # Optional, defaults to this
```

### 3. Initialize Database Indexes
The indexes will be created automatically on first use, but you can also create them manually by calling the `createMonitoringIndexes()` function from `src/lib/models/monitoring.ts`.

### 4. Set Up N8N Workflow

1. **Open your N8N instance** (e.g., `mdhusainil.app.n8n.cloud`)
2. **Create a new workflow** named "Tweet Monitor Cron"
3. **Add Schedule Trigger Node:**
   - Trigger: "Every 30 minutes"
   - Or use cron: `*/30 * * * *`
4. **Add HTTP Request Node:**
   - Method: `GET`
   - URL: `https://your-vercel-app.vercel.app/api/cron/check-monitors`
   - Replace `your-vercel-app` with your actual Vercel domain
5. **Activate the workflow** (toggle the "Active" switch)

That's it! N8N will now call your endpoint every 30 minutes automatically.

### 5. Test the System

1. **Start Monitoring:**
   - Go to `/twtengagement` page
   - Enter a tweet URL
   - Click "Start 24h Monitoring"
   - You'll be redirected to the monitoring dashboard

2. **View Dashboard:**
   - Navigate to `/monitor/[tweetId]`
   - See real-time metrics and charts
   - Dashboard auto-refreshes every 30 seconds

3. **Verify N8N:**
   - Check N8N execution history
   - Should see successful calls every 30 minutes
   - Check your MongoDB `metric_snapshots` collection for stored data

## How It Works

1. **User starts monitoring** → Creates job in `monitoring_jobs` collection
2. **N8N calls endpoint** → Every 30 minutes, calls `/api/cron/check-monitors`
3. **Endpoint processes jobs:**
   - Finds all active jobs (started within last 24 hours)
   - Calls Twitter API for each tweet
   - Stores metrics in `metric_snapshots` collection
   - Auto-marks jobs as completed after 24 hours
4. **User views dashboard** → Fetches all snapshots and displays in charts

## API Endpoints

- `POST /api/monitor-tweet/start` - Start monitoring a tweet
- `GET /api/cron/check-monitors` - Called by N8N to check all active tweets
- `GET /api/monitor-tweet/[tweetId]` - Get monitoring data for a tweet
- `POST /api/monitor-tweet/stop` - Manually stop monitoring

## Database Collections

- **`monitoring_jobs`**: Stores active monitoring sessions
- **`metric_snapshots`**: Stores each 30-minute snapshot of metrics

## Troubleshooting

### N8N not calling endpoint
- Check workflow is activated
- Verify URL is correct
- Check N8N execution logs

### No metrics being collected
- Verify `TWITTER_API_KEY` is set correctly
- Check Twitter API is responding
- Look at cron endpoint logs in Vercel

### Charts not showing
- Ensure `recharts` is installed: `npm install`
- Check browser console for errors
- Verify snapshots exist in database

## Notes

- Monitoring automatically stops after 24 hours
- Each tweet can only have one active monitoring job at a time
- Snapshots are stored every 30 minutes (when N8N runs)
- Dashboard auto-refreshes every 30 seconds for active monitoring

