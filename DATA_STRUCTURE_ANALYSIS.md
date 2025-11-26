# Engager Data Structure Analysis

## 1. COMPLETE DATA WE HAVE FOR EACH ENGAGER

Based on `ilpdts/src/lib/models/tweets.ts` (lines 23-44):

```typescript
interface Engager {
  userId: string;              // Twitter user ID
  username: string;            // @username
  name: string;                // Display name
  bio?: string;                // Profile bio (can be long, optional)
  location?: string;           // User location (optional)
  followers: number;           // Follower count
  verified: boolean;           // Verified badge status
  
  // Engagement types
  replied: boolean;            // Did they reply?
  retweeted: boolean;          // Did they retweet?
  quoted: boolean;             // Did they quote tweet?
  
  // Ranking data (optional, filled after ranking)
  importance_score?: number;   // Calculated importance score
  followed_by?: string[];      // Array of important usernames who follow them
}
```

**Total fields per engager: 11 fields** (7 required + 4 optional)

---

## 2. WHAT WE CURRENTLY SEND (AGGREGATED FORMAT)

From `ilpdts/src/lib/generate-ai-report.ts` - `buildPrompt()` function:

### Currently sent in prompt:

1. **Total count**: Single number
2. **Category breakdown**: 
   - 7 categories × (count + percentage) = ~14 numbers
3. **Follower tiers**: 
   - Array of tier strings + counts (~5-6 entries)
4. **Top 10 profiles**: 
   - Only top 10 engagers
   - Bio truncated to 80 characters
   - Format: `"Name (@username) – XK followers – Bio snippet"`
5. **VC firms**: 
   - Summary format with partner count
6. **Quality metrics**: 
   - 5 percentage/number values
7. **Notable people**: 
   - List of usernames and engagement types only

### Current format example:
```
Total Engagers: 200

Breakdown of Profiles:
- Founders/CEOs: 50 (25%)
- Investors: 30 (15%)
...

Highest Profile Engagers:
- John Doe (@johndoe) – 150K followers – Founder of Tech Startup...
- Jane Smith (@janesmith) – 200K followers – VC at a16z...
```

---

## 3. MOST EFFICIENT FORMAT TO SEND ALL ENGAGERS

Since you want to send **ALL data**, here are efficient format options:

### OPTION A: Compact JSON Array (Most Efficient)

```json
{
  "summary": {
    "total": 200,
    "categories": {...},
    "quality_metrics": {...}
  },
  "engagers": [
    ["userId", "username", "name", "followers", "verified", "replied", "retweeted", "quoted", "importance_score", "bio", "location"],
    ["123", "johndoe", "John Doe", 150000, true, true, false, false, 85.5, "Founder...", "SF"],
    ...
  ]
}
```

**Pros**: Most token-efficient (array of arrays)
**Cons**: Less readable, requires header row

---

### OPTION B: Compact Object Array (Balanced)

```json
{
  "summary": {...},
  "engagers": [
    {
      "u": "johndoe",           // username (short key)
      "n": "John Doe",          // name
      "f": 150000,              // followers
      "v": true,                // verified
      "r": true,                // replied
      "rt": true,               // retweeted
      "q": false,               // quoted
      "s": 85.5,                // importance_score
      "b": "Founder of...",     // bio (full or truncated?)
      "fb": ["user1", "user2"]  // followed_by
    },
    ...
  ]
}
```

**Pros**: 
- Readable structure
- ~50% smaller than full field names
- Easy to parse

**Cons**: Requires field mapping document

---

### OPTION C: CSV-like Text Format (Very Efficient)

```
SUMMARY:
Total: 200
Categories: founders=50, vcs=30, ...

ENGAGERS:
u:johndoe|n:John Doe|f:150000|v:1|r:1|rt:0|q:0|s:85.5|b:Founder of Tech...|fb:user1,user2
u:janesmith|n:Jane Smith|f:200000|v:1|r:0|rt:1|q:0|s:92.3|b:VC at a16z...|fb:user3
```

**Pros**: 
- Most compact text format
- Minimal delimiters
- Human-readable

**Cons**: Requires parsing logic

---

### OPTION D: Structured Compact Objects (Recommended for AI)

```json
{
  "total": 200,
  "summary": {
    "categories": {...},
    "metrics": {...}
  },
  "all_engagers": [
    {
      "un": "johndoe",      // username
      "nm": "John Doe",     // name
      "fl": 150000,         // followers
      "v": 1,               // verified (1/0 instead of true/false)
      "e": "r",             // engagement: r=replied, rt=retweeted, q=quoted, comma-separated
      "sc": 85.5,           // score
      "bio": "Founder..."   // bio (consider truncating if very long)
    }
  ]
}
```

**Pros**:
- Balanced efficiency/readability
- AI can easily parse
- Engagement as single field saves tokens
- Boolean as 1/0 saves tokens

---

## 4. TOKEN ESTIMATION

**Current format (aggregated)**:
- ~800-1,200 tokens for 200 engagers

**Sending all 200 engagers**:

| Format | Estimated Tokens | Savings |
|--------|-----------------|---------|
| Full JSON (all field names) | ~8,000-12,000 | Baseline |
| Option B (compact keys) | ~5,000-7,000 | ~40% savings |
| Option C (CSV-like) | ~4,000-6,000 | ~50% savings |
| Option D (recommended) | ~4,500-6,500 | ~45% savings |

---

## 5. RECOMMENDATIONS

### For sending ALL data efficiently:

1. **Use Option D** (Structured Compact Objects) - best balance
2. **Consider truncating bios** to 200 chars max (or exclude if too long)
3. **Use numeric codes** for engagement: `"e": "r,rt"` instead of separate booleans
4. **Omit empty fields**: Don't send `location` or `followed_by` if empty
5. **Send as JSON in prompt**: AI handles JSON well, maintains structure

### Implementation approach:

1. Create a `buildCompactEngagersList()` function
2. Format all engagers in compact structure
3. Include both summary AND full list
4. Let AI decide which details to highlight

---

## 6. FIELD ABBREVIATIONS (for Option D)

```
u / un  → username
n / nm  → name
fl      → followers
v       → verified (1/0)
e       → engagement (comma-separated: r,rt,q)
sc      → importance_score
bio     → bio (truncate to 200 chars)
loc     → location (omit if empty)
fb      → followed_by (array, omit if empty)
```

---

## 7. EXAMPLE FULL PROMPT STRUCTURE

```typescript
const prompt = `
You are analyzing Twitter engagement data. Generate a professional report.

SUMMARY:
Total: ${total}
Categories: ${compactCategories}
Metrics: ${metrics}

ALL ENGAGERS (${total} total):
${JSON.stringify(compactEngagersArray, null, 0)}  // minified JSON

Generate report highlighting key insights from ALL engagers...
`;
```

