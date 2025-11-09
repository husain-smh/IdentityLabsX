# 🤖 Bot Task Extractor - Setup Guide

## ✅ What's Been Built

Your AI-powered task extraction pipeline is ready! Here's what was created:

### **Files Created:**
1. **`src/lib/mongodb.ts`** - MongoDB connection utility with singleton pattern
2. **`src/app/api/extract-task/route.ts`** - API endpoint for LLM extraction
3. **`src/app/bot/page.tsx`** - Beautiful UI for text input and results display

---

## 🔧 Environment Setup

### **Required: Add to your `.env` file**

You mentioned you already have `OPENAIAPIKEY` set. Just make sure your `.env` file has both variables:

```env
# OpenAI API Key (you already have this)
OPENAIAPIKEY=sk-proj-xxxxxxxxxxxxx

# MongoDB URI (add this)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

### **Getting MongoDB URI:**

**Option 1: MongoDB Atlas (Recommended - Free)**
1. Go to [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
2. Create free account → Create free M0 cluster
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your database password
6. Paste it as `MONGODB_URI` in your `.env` file

**Option 2: Local MongoDB**
```env
MONGODB_URI=mongodb://localhost:27017/taskdb
```

---

## 🚀 How to Use

### **1. Start Your Dev Server**
```bash
cd ilpdts
npm run dev
```

### **2. Navigate to Bot Page**
Open: [http://localhost:3000/bot](http://localhost:3000/bot)

### **3. Test with Sample Text**

Paste this example:
```
Ruchir please finish the landing page redesign by next Tuesday. 
Husain will help with copywriting. Add this to marketing sprint.

Also, we need to brainstorm ideas for the new feature launch campaign. 
Schedule meeting with design team for Friday.
```

### **4. Click "Process & Store"**

The system will:
- ✅ Send text to OpenAI GPT-4o-mini
- ✅ Extract structured task data
- ✅ Save to MongoDB `taskdb.tasks` collection
- ✅ Display results on screen

---

## 📊 Data Schema

Each extracted task is stored in MongoDB with this structure:

```json
{
  "task": "Finish landing page redesign",
  "type": "task",
  "urgency": "high",
  "startDate": null,
  "endDate": "2025-11-04T00:00:00Z",
  "description": "Complete landing page with copywriting help",
  "tags": ["marketing", "design"],
  "assignedTo": ["Ruchir", "Husain"],
  "createdAt": "2025-10-27T12:34:56.789Z"
}
```

---

## 🎨 Features Implemented

- **Clean UI** matching your Identity Labs design system
- **Real-time Processing** with loading states
- **Smart Error Handling** with user-friendly messages
- **Input Validation** (max 10,000 chars to control costs)
- **Beautiful Results Display** with color-coded urgency levels
- **Type Icons** for tasks, ideas, and notes
- **Responsive Design** works on mobile and desktop
- **MongoDB Connection Pooling** for serverless optimization

---

## 🛡️ Error Handling

The system handles:
- ❌ Empty input
- ❌ OpenAI API failures
- ❌ MongoDB connection issues
- ❌ Invalid JSON from LLM
- ❌ Network timeouts
- ❌ Overly long inputs

All errors show user-friendly messages in the UI.

---

## 💰 Cost Estimate

Using `gpt-4o-mini`:
- **~$0.0001 per request** (extremely cheap)
- 1000 requests = ~$0.10
- Very cost-effective for MVP testing

---

## 🧪 Verify MongoDB Storage

After processing text, check your MongoDB:

**Using MongoDB Atlas UI:**
1. Go to your cluster → "Browse Collections"
2. Database: `taskdb`
3. Collection: `tasks`
4. You should see your extracted tasks

**Using MongoDB Compass:**
1. Connect using your `MONGODB_URI`
2. Navigate to `taskdb` → `tasks`

---

## 🐛 Troubleshooting

### "Please add your MONGODB_URI"
→ Add `MONGODB_URI` to your `.env` file and restart dev server

### "OpenAI API error"
→ Check that `OPENAIAPIKEY` is correct in `.env` file

### "Database error"
→ Verify MongoDB URI format and network access in Atlas

### "Failed to parse LLM response"
→ LLM returned unexpected format (rare) - try again or check logs

---

## 🎯 Next Steps (Optional Enhancements)

- Add pagination for viewing stored tasks
- Build a dashboard to search/filter tasks
- Add edit/delete functionality
- Implement user authentication
- Add task status updates (todo → in-progress → done)
- Export tasks to CSV/JSON
- Add date range filtering

---

## 📝 Technical Details

**Stack:**
- Next.js 15 (App Router)
- TypeScript
- MongoDB (with connection pooling)
- OpenAI GPT-4o-mini
- Tailwind CSS

**API Endpoint:**
- `POST /api/extract-task`
- Body: `{ "text": "your message here" }`
- Returns: `{ success, message, inserted, data[] }`

**Database:**
- Database: `taskdb`
- Collection: `tasks`
- No indexes yet (add later for performance)

---

## ✨ You're Ready!

The complete pipeline is built and ready to test. Just:
1. ✅ Add `MONGODB_URI` to your `.env` file
2. ✅ Restart dev server (`npm run dev`)
3. ✅ Visit `/bot` page
4. ✅ Start extracting tasks!

---

Built by Identity Labs • AI-Powered Task Management

