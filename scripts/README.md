# SOCAP Job Scheduler

This directory contains standalone scripts for managing SOCAP jobs outside of N8N.

## 📁 Files

### `job-scheduler.ts`
A Node.js cron scheduler that replaces N8N workflows for triggering and processing SOCAP jobs.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install node-cron dotenv
npm install -D @types/node-cron tsx
```

### 2. Configure Environment

Make sure your `.env` file has:

```env
NEXT_PUBLIC_BASE_URL=https://identity-labs-x.vercel.app
```

Or set it when running the script:

```bash
NEXT_PUBLIC_BASE_URL=https://your-domain.com npx tsx scripts/job-scheduler.ts
```

### 3. Run the Scheduler

**Development:**
```bash
npx tsx scripts/job-scheduler.ts
```

**Production (with PM2):**
```bash
# Install PM2 globally
npm install -g pm2

# Start scheduler
pm2 start scripts/job-scheduler.ts --interpreter=node --interpreter-args="--loader tsx"

# View logs
pm2 logs job-scheduler

# Stop
pm2 stop job-scheduler

# Restart
pm2 restart job-scheduler

# Auto-start on system boot
pm2 startup
pm2 save
```

## ⏰ Default Schedule

| Job Name | Endpoint | Interval | Purpose |
|----------|----------|----------|---------|
| Create Jobs | `/api/socap/workers/trigger` | Every 15 minutes | Enqueues jobs for active campaigns |
| Process Jobs | `/api/socap/workers/run` | Every 5 minutes | Processes pending jobs in queue |

## 🔧 Customization

### Adding New Jobs

Edit `job-scheduler.ts` and add to the `JOBS` array:

```typescript
const JOBS: SchedulerConfig[] = [
  // ... existing jobs ...
  {
    name: 'Custom Alert Job',
    endpoint: `${API_BASE_URL}/api/socap/alerts/process`,
    interval: '*/10 * * * *', // Every 10 minutes
    method: 'POST',
  },
];
```

### Cron Interval Formats

```
┌────────────── minute (0 - 59)
│ ┌──────────── hour (0 - 23)
│ │ ┌────────── day of month (1 - 31)
│ │ │ ┌──────── month (1 - 12)
│ │ │ │ ┌────── day of week (0 - 6, Sunday = 0)
│ │ │ │ │
* * * * *
```

**Common Patterns:**
- `*/2 * * * *` - Every 2 minutes
- `*/5 * * * *` - Every 5 minutes
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour (at minute 0)
- `0 0 * * *` - Every day at midnight
- `0 9 * * 1` - Every Monday at 9 AM

### Changing Intervals

Simply update the `interval` field:

```typescript
{
  name: 'Process Jobs (Run Workers)',
  endpoint: `${API_BASE_URL}/api/socap/workers/run`,
  interval: '*/2 * * * *', // Changed from 5 to 2 minutes
  method: 'POST',
},
```

## 📊 Monitoring

### View Logs
The scheduler outputs detailed logs:
- ✅ Success messages with duration
- ❌ Error messages with details
- 📊 Response data from APIs

### Health Check
Check if jobs are running:
```bash
# With PM2
pm2 status

# Manual (check process)
ps aux | grep job-scheduler
```

## 🆚 Comparison: Node Script vs cron-job.org

| Feature | Node Script | cron-job.org |
|---------|-------------|--------------|
| **Cost** | Free | Free |
| **Setup Time** | 5 minutes | 10 minutes |
| **Hosting** | Requires server/computer | Cloud-based |
| **Flexibility** | Full control | Limited |
| **Monitoring** | Custom logs | Built-in dashboard |
| **Reliability** | Depends on host | Very reliable |

**Recommendation:**
- **Use Node Script** if you already have a server/VPS running 24/7
- **Use cron-job.org** if you want zero maintenance and don't have hosting

## 🐛 Troubleshooting

### Issue: "fetch is not defined"
**Solution:** Use Node.js 18+ which has native fetch support

```bash
node --version  # Should be v18.0.0 or higher
```

Or install node-fetch:
```bash
npm install node-fetch
```

### Issue: Jobs not running
**Check:**
1. Is the script still running? (`ps aux | grep job-scheduler`)
2. Check logs for errors
3. Verify API_BASE_URL is correct
4. Test endpoints manually with curl

### Issue: Connection errors
**Possible causes:**
- API is down
- Wrong URL in `.env`
- Firewall blocking requests
- SSL certificate issues

## 🔐 Security Notes

- **Never commit** `.env` files with production URLs
- Use environment variables for sensitive data
- Consider adding API authentication if exposing endpoints publicly
- Monitor logs for suspicious activity

## 📚 Additional Resources

- [node-cron documentation](https://www.npmjs.com/package/node-cron)
- [PM2 Process Manager](https://pm2.keymetrics.io/)
- [Cron expression generator](https://crontab.guru/)

