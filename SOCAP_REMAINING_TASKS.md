# SOCAP - Remaining Tasks & Improvements

## 🔴 Critical Missing Pieces

### 1. **Metric Snapshot Creation** ⚠️
**Issue**: Metrics worker updates individual tweet metrics, but doesn't create campaign-level snapshots for charts.

**Fix Needed**: 
- After all metrics jobs for a campaign complete, call `aggregateCampaignMetrics()`
- Add this to worker orchestrator or create a post-processing step

**Location**: `src/lib/socap/workers/worker-orchestrator.ts` or create a new post-processor

---

### 2. **Campaign Creation Frontend Page** ❌
**Issue**: Backend API exists, but no frontend form to create campaigns.

**Fix Needed**: 
- Create `/socap/create` page with form
- Form fields: launch_name, client_info, tweet URLs (main/influencer/investor), monitor window, alert preferences

**Location**: `src/app/socap/create/page.tsx`

---

### 3. **Email Sending Implementation** ⚠️
**Issue**: Email alert sending is just a placeholder (logs to console).

**Fix Needed**: 
- Integrate with email service (SendGrid, AWS SES, Nodemailer, etc.)
- Implement actual email sending in `alert-sender.ts`

**Location**: `src/lib/socap/alert-sender.ts` - `sendEmailAlert()` function

---

## 🟡 Nice-to-Have Improvements

### 4. **Standalone Worker Service** 📝
**Issue**: Worker orchestrator exists but needs a standalone service file for deployment.

**Fix Needed**: 
- Create `scripts/socap-worker.ts` or similar
- Can be run as a separate Node.js process
- Handles continuous job processing

**Location**: `scripts/socap-worker.ts` or `src/lib/socap/worker-service.ts`

---

### 5. **Reply/Quote Text Fetching** 📝
**Issue**: Currently we don't fetch the actual text of replies/quotes (mentioned as limitation).

**Fix Needed**: 
- Enhance replies/quotes workers to fetch full tweet text
- Store in engagement document
- Display in dashboard

**Location**: `src/lib/socap/workers/replies-worker.ts` and `quotes-worker.ts`

---

### 6. **Campaign Completion Handler** 📝
**Issue**: No automatic handling when monitor window ends.

**Fix Needed**: 
- Check for campaigns past end_date
- Set status to "completed"
- Generate final report
- Stop processing

**Location**: Add to worker trigger or create separate cron job

---

### 7. **Error Recovery & Retry Logic** 📝
**Issue**: Basic retry exists, but could be improved.

**Fix Needed**: 
- Better retry strategy for failed jobs
- Exponential backoff
- Max retry limits
- Dead letter queue for permanently failed jobs

**Location**: `src/lib/socap/job-queue.ts` and worker base class

---

### 8. **Dashboard Enhancements** 📝
**Issue**: Basic dashboard exists, but could be enhanced.

**Fix Needed**: 
- Filtering by date range
- Export functionality
- More detailed engagement views
- Tweet-specific detail pages
- Account engagement timeline view

**Location**: `src/app/socap/campaigns/[id]/page.tsx`

---

### 9. **Caching Implementation** 📝
**Issue**: Dashboard API mentions caching but not implemented.

**Fix Needed**: 
- Add Redis or in-memory cache
- Cache dashboard data with 1-minute TTL
- Invalidate on new engagement

**Location**: `src/app/api/socap/campaigns/[id]/dashboard/route.ts`

---

### 10. **Testing** 📝
**Issue**: No tests written.

**Fix Needed**: 
- Unit tests for workers
- Integration tests for APIs
- E2E tests for critical flows

**Location**: Create `__tests__` directories

---

## 🟢 Documentation & Setup

### 11. **Deployment Guide** 📝
**Issue**: Setup instructions exist but could be more detailed.

**Fix Needed**: 
- Step-by-step deployment guide
- Environment variable documentation
- N8N workflow setup guide
- Cron job setup instructions

**Location**: `DEPLOYMENT.md` or enhance `SOCAP_IMPLEMENTATION_SUMMARY.md`

---

### 12. **API Documentation** 📝
**Issue**: No API documentation.

**Fix Needed**: 
- OpenAPI/Swagger spec
- Or at least markdown with all endpoints
- Request/response examples

**Location**: `SOCAP_API_DOCS.md`

---

## 📋 Priority Order

### **Must Have (Before Production)**
1. ✅ Metric snapshot creation integration
2. ✅ Campaign creation frontend page
3. ✅ Email sending implementation

### **Should Have (Soon)**
4. Standalone worker service
5. Campaign completion handler
6. Better error recovery

### **Nice to Have (Later)**
7. Reply/quote text fetching
8. Dashboard enhancements
9. Caching
10. Testing
11. Documentation improvements

---

## 🚀 Quick Wins (Can Do Now)

1. **Metric Snapshot Integration** - 15 minutes
   - Add call to `aggregateCampaignMetrics()` after metrics jobs complete

2. **Campaign Creation Page** - 30 minutes
   - Simple form with all required fields

3. **Email Sending** - 30-60 minutes
   - Choose email service and implement

4. **Standalone Worker Service** - 15 minutes
   - Simple script that runs orchestrator

---

## Summary

**Critical**: 3 items (metric snapshots, create page, email)
**Important**: 3 items (worker service, completion handler, error recovery)
**Enhancements**: 6 items (various improvements)

**Total Estimated Time**: 
- Critical: ~2 hours
- Important: ~3 hours
- Enhancements: ~8 hours

**Recommendation**: Focus on the 3 critical items first, then the important ones before production deployment.

