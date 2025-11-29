# SOCAP Testing Guide

## 🚀 Quick Start Testing

### Step 1: Start Development Server

```bash
npm run dev
```

This starts Next.js on `http://localhost:3000`

---

### Step 2: Initialize Database

**Option A: Via Browser**
- Visit: `http://localhost:3000/api/socap/init-db`
- Should see: `{"success":true,"message":"SOCAP database indexes initialized successfully"}`

**Option B: Via curl**
```bash
curl http://localhost:3000/api/socap/init-db
```

**What this does**: Creates all required MongoDB indexes for optimal performance.

---

### Step 3: Create a Test Campaign

**Option A: Via Frontend (Recommended)**
1. Visit: `http://localhost:3000/socap/create`
2. Fill in the form:
   - **Launch Name**: "Test Campaign"
   - **Client Name**: "Test Client"
   - **Client Email**: "test@example.com"
   - **Start Date**: Today
   - **End Date**: 3 days from now
   - **Main Tweets**: Add at least one Twitter URL
     - Example: `https://twitter.com/elonmusk/status/1234567890` (use a real tweet URL)
   - **Importance Threshold**: 10
   - **Alert Channels**: Check "Email" (or "Slack" if configured)
3. Click "Create Campaign"
4. You'll be redirected to the campaign dashboard

**Option B: Via API**
```bash
curl -X POST http://localhost:3000/api/socap/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "launch_name": "Test Campaign",
    "client_info": {
      "name": "Test Client",
      "email": "test@example.com"
    },
    "maintweets": [
      {"url": "https://twitter.com/user/status/1234567890"}
    ],
    "influencer_twts": [],
    "investor_twts": [],
    "monitor_window": {
      "start_date": "2025-01-01T00:00:00Z",
      "end_date": "2025-01-04T00:00:00Z"
    },
    "alert_preferences": {
      "importance_threshold": 10,
      "channels": ["email"],
      "frequency_window_minutes": 30,
      "alert_spacing_minutes": 20
    }
  }'
```

**Note**: Replace the tweet URL with a real Twitter/X URL!

---

### Step 4: Trigger Workers (Enqueue Jobs)

**Option A: Via API**
```bash
curl -X POST http://localhost:3000/api/socap/workers/trigger
```

**Option B: Set up N8N** (for production)
- Create N8N workflow that calls this endpoint every 30 minutes

**What this does**: 
- Finds all active campaigns
- Enqueues jobs for all tweets (retweets, replies, quotes, metrics)
- Returns summary of jobs enqueued

---

### Step 5: Process Jobs (Run Workers)

You have **two options**:

#### Option A: Manual Processing (Testing)

```bash
curl -X POST http://localhost:3000/api/socap/workers/run \
  -H "Content-Type: application/json" \
  -d '{
    "maxJobs": 50,
    "concurrency": 5
  }'
```

This processes jobs immediately and returns stats.

#### Option B: Continuous Worker Service (Production)

**In a separate terminal**, run:
```bash
npm run worker
```

This starts a continuous worker service that:
- Processes jobs continuously
- Handles retries automatically
- Runs until you stop it (Ctrl+C)

**Note**: You need `tsx` installed:
```bash
npm install -D tsx
```

---

### Step 6: Check Worker Status

```bash
curl http://localhost:3000/api/socap/workers/status
```

Returns:
```json
{
  "success": true,
  "data": {
    "job_queue": {
      "pending": 10,
      "processing": 2,
      "completed": 45,
      "failed": 1
    },
    "timestamp": "2025-01-01T12:00:00Z"
  }
}
```

---

### Step 7: View Dashboard

1. Visit: `http://localhost:3000/socap`
2. Click on your campaign
3. Dashboard shows:
   - Total metrics (likes, retweets, etc.)
   - Latest engagements
   - Category breakdown
   - Time-series charts (after metrics snapshots are created)

---

### Step 8: Process Alerts (Optional)

If you have high-importance engagements, process alerts:

```bash
curl -X POST http://localhost:3000/api/socap/alerts/process \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

**Note**: For production, set up a cron job to call this every 2-3 minutes.

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Database initialized (`/api/socap/init-db`)
- [ ] Campaign created (`/socap/create` or API)
- [ ] Jobs enqueued (`POST /api/socap/workers/trigger`)
- [ ] Jobs processed (`POST /api/socap/workers/run` or worker service)
- [ ] Dashboard displays data (`/socap/campaigns/{id}`)

### Advanced Testing
- [ ] Multiple campaigns created
- [ ] Worker service runs continuously
- [ ] Metric snapshots created (check after metrics jobs complete)
- [ ] Alerts detected and queued
- [ ] Alerts sent (if email/Slack configured)
- [ ] Campaign auto-completes when window ends
- [ ] Retry logic works (intentionally fail a job)

---

## 🔍 Debugging Tips

### Check Database Collections

If you have MongoDB Compass or similar:
- Check `socap_campaigns` - Your campaigns
- Check `socap_tweets` - Tweet documents
- Check `socap_engagements` - Engagement data
- Check `socap_job_queue` - Job status
- Check `socap_worker_state` - Worker cursors/state
- Check `socap_metric_snapshots` - Time-series data

### Check Logs

Watch the terminal where `npm run dev` is running for:
- Worker processing logs
- Error messages
- API calls

### Common Issues

1. **"Campaign not found"**
   - Check campaign was created successfully
   - Verify campaign ID in URL

2. **"No jobs to process"**
   - Make sure you called `/api/socap/workers/trigger` first
   - Check campaign is active and within monitor window

3. **"Tweet not found"**
   - Verify tweet URL is valid
   - Check Twitter API key is configured

4. **"Email not sent"**
   - Check email service is configured
   - Verify environment variables are set
   - Check console logs for email content (if using console fallback)

---

## 📊 Expected Flow

1. **Create Campaign** → Campaign created, tweets resolved, worker states initialized
2. **Trigger Workers** → Jobs enqueued (4 jobs per tweet)
3. **Process Jobs** → Workers fetch data, store engagements, update metrics
4. **Metric Snapshots** → Created after all metrics jobs complete
5. **Alert Detection** → High-importance engagements trigger alerts
6. **Alert Sending** → Alerts sent via configured channels
7. **Dashboard** → Shows all data in real-time

---

## 🎯 Quick Test Script

Save this as `test-socap.sh`:

```bash
#!/bin/bash

echo "1. Initializing database..."
curl http://localhost:3000/api/socap/init-db

echo -e "\n\n2. Creating test campaign..."
curl -X POST http://localhost:3000/api/socap/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "launch_name": "Quick Test",
    "client_info": {"name": "Test", "email": "test@test.com"},
    "maintweets": [{"url": "YOUR_TWEET_URL_HERE"}],
    "influencer_twts": [],
    "investor_twts": [],
    "monitor_window": {
      "start_date": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "end_date": "'$(date -u -d '+3 days' +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "alert_preferences": {
      "importance_threshold": 10,
      "channels": ["email"],
      "frequency_window_minutes": 30,
      "alert_spacing_minutes": 20
    }
  }'

echo -e "\n\n3. Triggering workers..."
curl -X POST http://localhost:3000/api/socap/workers/trigger

echo -e "\n\n4. Processing jobs..."
curl -X POST http://localhost:3000/api/socap/workers/run \
  -H "Content-Type: application/json" \
  -d '{"maxJobs": 20, "concurrency": 3}'

echo -e "\n\n5. Checking status..."
curl http://localhost:3000/api/socap/workers/status

echo -e "\n\nDone! Visit http://localhost:3000/socap to see your campaigns"
```

Make it executable: `chmod +x test-socap.sh`
Run: `./test-socap.sh` (replace YOUR_TWEET_URL_HERE with a real URL)

---

## ✅ Success Indicators

You know everything is working when:
- ✅ Campaign appears in `/socap` list
- ✅ Dashboard shows metrics and engagements
- ✅ Jobs are being processed (check status endpoint)
- ✅ Metric snapshots are created (check database or wait for charts to populate)
- ✅ No errors in console/logs

Happy testing! 🚀

