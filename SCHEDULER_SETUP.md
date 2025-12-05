# 🎯 Quick Start: Replace N8N with Job Scheduler

## 📦 Installation (One Command)

```bash
npm install node-cron @types/node-cron
```

That's it! You already have `tsx` and `dotenv` installed.

---

## 🚀 Running the Scheduler

### Method 1: Local/Server (Recommended if you have a server)

**Start the scheduler:**
```bash
npm run scheduler
```

**Or with custom URL:**
```bash
NEXT_PUBLIC_BASE_URL=https://your-domain.com npm run scheduler
```

**Keep it running 24/7 with PM2:**
```bash
# Install PM2 (one-time)
npm install -g pm2

# Start scheduler in background
pm2 start "npm run scheduler" --name socap-scheduler

# View logs
pm2 logs socap-scheduler

# Monitor
pm2 monit

# Stop
pm2 stop socap-scheduler
```

---

### Method 2: cron-job.org (Recommended if you don't have a server)

1. **Go to:** https://cron-job.org
2. **Sign up** (free account)
3. **Create two cron jobs:**

#### Job 1: Create Jobs (Trigger)
- **Title:** `SOCAP Create Jobs`
- **URL:** `https://identity-labs-x.vercel.app/api/socap/workers/trigger`
- **Method:** `POST`
- **Schedule:** `*/15 * * * *` (every 15 minutes)
- **Click:** "Execute now" to test

#### Job 2: Process Jobs (Run)
- **Title:** `SOCAP Process Jobs`
- **URL:** `https://identity-labs-x.vercel.app/api/socap/workers/run`
- **Method:** `POST`
- **Schedule:** `*/5 * * * *` (every 5 minutes)
- **Request Body:** (optional)
  ```json
  {
    "maxJobs": 100,
    "concurrency": 5
  }
  ```
- **Click:** "Execute now" to test

---

## 🔍 What Your Scheduler Does

### Current N8N Workflow → New Setup

| What | N8N (Old) | New Scheduler |
|------|-----------|---------------|
| **Trigger** | Schedule Trigger (15 min) | `*/15 * * * *` |
| **Action** | HTTP Request → `/api/socap/workers/trigger` | Same endpoint |
| **Method** | POST | POST |
| **Cost** | N8N workflow limit | FREE ✅ |

### The Two Jobs Work Together:

1. **Job Creator** (`/api/socap/workers/trigger`) - Every 15 minutes
   - Finds all active campaigns
   - Creates jobs for each tweet (retweets, replies, quotes, metrics)
   - Adds them to the job queue

2. **Job Processor** (`/api/socap/workers/run`) - Every 5 minutes
   - Picks up pending jobs from queue
   - Processes them (fetches Twitter data, updates database)
   - Handles retries and errors

---

## ✅ Testing Your Setup

### 1. Manual Test (Before Scheduling)

Test each endpoint manually:

```bash
# Test job creation
curl -X POST https://identity-labs-x.vercel.app/api/socap/workers/trigger

# Test job processing
curl -X POST https://identity-labs-x.vercel.app/api/socap/workers/run \
  -H "Content-Type: application/json" \
  -d '{"maxJobs": 50, "concurrency": 3}'
```

### 2. Verify Scheduler is Running

If using Node script:
```bash
# Check if running
ps aux | grep job-scheduler

# Or with PM2
pm2 status
```

If using cron-job.org:
- Check dashboard for execution history
- Look for green checkmarks (success)
- Review logs for any errors

### 3. Monitor Your Application

Check your application logs to verify:
- Jobs are being created
- Workers are processing them
- No errors in the pipeline

---

## 🎛️ Customization

### Change Intervals

Edit `scripts/job-scheduler.ts`:

```typescript
const JOBS: SchedulerConfig[] = [
  {
    name: 'Create Jobs (Trigger Workers)',
    endpoint: `${API_BASE_URL}/api/socap/workers/trigger`,
    interval: '*/10 * * * *', // Changed from 15 to 10 minutes
    method: 'POST',
  },
  {
    name: 'Process Jobs (Run Workers)',
    endpoint: `${API_BASE_URL}/api/socap/workers/run`,
    interval: '*/2 * * * *', // Changed from 5 to 2 minutes
    method: 'POST',
  },
];
```

### Add More Jobs

```typescript
const JOBS: SchedulerConfig[] = [
  // ... existing jobs ...
  {
    name: 'Process Alerts',
    endpoint: `${API_BASE_URL}/api/socap/alerts/process`,
    interval: '*/10 * * * *', // Every 10 minutes
    method: 'POST',
  },
];
```

---

## 🆚 Which Method Should You Choose?

| Criteria | Node Script | cron-job.org |
|----------|-------------|--------------|
| **You have a server/VPS** | ✅ Best choice | ⚠️ Works but unnecessary |
| **No server available** | ❌ Need hosting | ✅ Perfect solution |
| **Want full control** | ✅ Complete control | ⚠️ Limited options |
| **Want zero maintenance** | ⚠️ Need to monitor | ✅ Set and forget |
| **Need custom logic** | ✅ Easy to extend | ❌ Can't customize |
| **Setup time** | 5 minutes | 10 minutes |
| **Cost** | Server costs | FREE |

### Recommendation:

- **Run on Vercel/Netlify?** → Use **cron-job.org** (easiest)
- **Have VPS/EC2/DigitalOcean?** → Use **Node script** (more control)
- **Run locally for dev?** → Use **Node script** (best for testing)

---

## 🔥 Quick Decision Tree

```
Do you have a server running 24/7?
├─ YES → Use Node script (npm run scheduler)
│   └─ Want background? → Use PM2
└─ NO → Use cron-job.org
    └─ 2-minute intervals needed? → Node script on cheap VPS
        (cron-job.org can do 1-min minimum, so you're fine!)
```

---

## 🚨 Before Disabling N8N

**Checklist:**
- [ ] Install dependencies (`npm install node-cron @types/node-cron`)
- [ ] Test trigger endpoint manually
- [ ] Test run endpoint manually
- [ ] Start scheduler (Node or cron-job.org)
- [ ] Wait 15+ minutes and verify jobs are running
- [ ] Check application logs for errors
- [ ] Verify data is being updated in database
- [ ] **ONLY THEN** disable N8N workflow

---

## 📚 Additional Resources

- See `scripts/README.md` for detailed documentation
- Cron expression tester: https://crontab.guru/
- PM2 docs: https://pm2.keymetrics.io/
- cron-job.org docs: https://cron-job.org/en/documentation/

---

## 🆘 Need Help?

Common issues and solutions in `scripts/README.md` under "Troubleshooting" section.

