# SOCAP N8N Setup Guide

## 🔗 N8N Scheduler URL

### Endpoint Details
- **Method**: `POST`
- **Path**: `/api/socap/workers/trigger`
- **Content-Type**: `application/json` (optional, no body needed)

### URL Examples

**Local Development** (for testing only):
```
http://localhost:3000/api/socap/workers/trigger
```
⚠️ **Note**: N8N can't access localhost unless running on same machine. For production, you need a deployed URL.

**Production** (after deployment):
```
https://yourdomain.com/api/socap/workers/trigger
```

### N8N Workflow Setup

1. **Create Schedule Trigger Node**
   - Set interval: `30 minutes` (or your desired interval)
   - Or use cron: `*/30 * * * *` (every 30 minutes)

2. **Add HTTP Request Node**
   - **Method**: `POST`
   - **URL**: `https://yourdomain.com/api/socap/workers/trigger`
   - **Authentication**: None (or add if you implement auth)
   - **Body**: Leave empty (no body needed)

3. **Optional: Add Error Handling**
   - Add IF node to check response
   - Log errors if `success: false`

### Example N8N Workflow JSON
```json
{
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "minutes",
              "minutesInterval": 30
            }
          ]
        }
      }
    },
    {
      "name": "Trigger SOCAP Workers",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://yourdomain.com/api/socap/workers/trigger",
        "options": {}
      }
    }
  ]
}
```

---

## ⏰ Changing Schedule Interval (30 min → 15 min)

### What Needs to Change

#### 1. **N8N Configuration** (No Code Changes)
- Just change the schedule trigger interval in N8N from 30 minutes to 15 minutes
- That's it for basic functionality!

#### 2. **Code Changes** (Optional but Recommended)

If you want to make the system fully support 15-minute intervals, update these:

**A. Alert Batch Rounding** (`src/lib/socap/alert-detector.ts`)

**Current** (line 77-84):
```typescript
function getCurrentRunBatch(): string {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = Math.floor(minutes / 30) * 30; // Hardcoded 30
  const rounded = new Date(now);
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded.toISOString();
}
```

**Change to** (make it configurable):
```typescript
function getCurrentRunBatch(intervalMinutes: number = 30): string {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
  const rounded = new Date(now);
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded.toISOString();
}
```

Then update the call (line 27):
```typescript
const runBatch = getCurrentRunBatch(15); // Use 15 for 15-minute intervals
```

**B. Alert Spacing** (Consider reducing)

**Current**: Alert spacing is 20 minutes (designed for 30-minute cycle)

**For 15-minute intervals**, you might want:
- Reduce `alert_spacing_minutes` to `10` or `12` minutes
- This ensures alerts from one run are sent before the next run starts

**C. Comments/Documentation**

Update comments that mention "30 minutes" to reflect your actual interval.

---

## 📋 Quick Change Checklist (30 min → 15 min)

### Required Changes:
- ✅ **N8N Schedule**: Change interval to 15 minutes (no code change)

### Recommended Changes:
- ⚠️ **Alert Batch Rounding**: Make `getCurrentRunBatch()` use 15 instead of 30
- ⚠️ **Alert Spacing**: Consider reducing from 20 to 10-12 minutes per campaign
- ⚠️ **Comments**: Update documentation

### Optional Changes:
- 📝 **Frequency Window**: Keep at 30 minutes (prevents duplicate alerts)
- 📝 **Worker Processing**: No changes needed (works with any interval)

---

## 🚀 Deployment Requirements

### Before N8N Can Access Your API:

1. **Deploy Your Application**
   - Deploy to Vercel, Railway, Render, AWS, etc.
   - Get your production URL

2. **Environment Variables**
   - Set `MONGODB_URI` (production database)
   - Set `TWITTER_API_KEY`
   - Set any other required env vars

3. **Test the Endpoint**
   ```bash
   curl -X POST https://yourdomain.com/api/socap/workers/trigger
   ```
   Should return: `{"success":true,...}`

4. **Configure N8N**
   - Use the production URL in N8N workflow
   - Set your desired schedule interval

---

## 🔒 Security Considerations

### Optional: Add Authentication

If you want to secure the endpoint, add authentication:

**Option 1: API Key**
```typescript
// In route.ts
const apiKey = request.headers.get('X-API-Key');
if (apiKey !== process.env.SOCAP_API_KEY) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Option 2: Bearer Token**
```typescript
const authHeader = request.headers.get('Authorization');
if (authHeader !== `Bearer ${process.env.SOCAP_AUTH_TOKEN}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Then configure in N8N HTTP Request node:
- **Authentication**: Header Auth
- **Name**: `X-API-Key` or `Authorization`
- **Value**: Your secret key/token

---

## 📊 Testing the Setup

### 1. Test Locally First
```bash
# Start dev server
npm run dev

# In another terminal, test the endpoint
curl -X POST http://localhost:3000/api/socap/workers/trigger
```

### 2. Test After Deployment
```bash
curl -X POST https://yourdomain.com/api/socap/workers/trigger
```

### 3. Check N8N Execution Logs
- N8N will show execution history
- Check if requests are successful
- Monitor for any errors

---

## 🎯 Summary

**For N8N Setup:**
1. Deploy your app to get a public URL
2. Use: `https://yourdomain.com/api/socap/workers/trigger`
3. Configure N8N to POST to this URL every 30 minutes (or your desired interval)

**For 15-Minute Schedule:**
1. Change N8N interval to 15 minutes ✅
2. Update `getCurrentRunBatch()` to use 15 instead of 30 ⚠️
3. Consider reducing alert spacing to 10-12 minutes ⚠️
4. Update comments/documentation 📝

The system will work with 15-minute intervals even without code changes, but the batch grouping and alert spacing will be optimized for 30-minute cycles.

