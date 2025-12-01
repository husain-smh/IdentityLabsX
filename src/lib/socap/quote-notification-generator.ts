import OpenAI from 'openai';

type SentimentLabel = 'positive' | 'neutral' | 'critical';

export interface QuotePromptTweetContext {
  authorName: string;
  authorUsername: string;
  text?: string;
  url?: string;
}

export interface QuotePromptQuote {
  engagementId: string;
  accountName: string;
  accountUsername: string;
  followers: number;
  importanceScore: number;
  verified: boolean;
  quoteText?: string;
  accountBio?: string;
  timestampISO: string;
}

export interface QuoteNotificationSuggestion {
  engagementIds: string[];
  notification: string;
  sentiment: SentimentLabel;
}

export interface QuoteNotificationPrompt {
  campaignName: string;
  mainTweet: QuotePromptTweetContext;
  quotes: QuotePromptQuote[];
}

const openAiKey = process.env.OPENAIAPIKEY;
const openai = openAiKey
  ? new OpenAI({
      apiKey: openAiKey,
    })
  : null;

function buildPrompt(payload: QuoteNotificationPrompt): string {
  const instructions = `
You are an assistant that composes concise, high-signal notifications about important quote tweets.

INPUT (JSON):
${JSON.stringify(payload, null, 2)}

REQUIREMENTS:
1. Read the main tweet context and each quote.
2. Return JSON ONLY. Do not include explanations.
3. Output format (array of 1-5 objects):
[
  {
    "engagement_ids": ["id1", "id2"],
    "notification": "Concise human-friendly sentence mentioning the relevant accounts and what they said.",
    "sentiment": "positive|neutral|critical"
  }
]
4. You may combine multiple quotes into one notification if it reads better (list all relevant usernames). Otherwise, create separate notifications.
5. Include key specifics (topic or stance) when possible. Stay under 240 characters per notification.
6. Sentiment should reflect the quote tone toward the original tweet.
`;

  return instructions.trim();
}

function extractJsonArray(raw: string): unknown {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM response did not contain a JSON array');
  }
  const jsonSegment = raw.slice(start, end + 1);
  return JSON.parse(jsonSegment);
}

export async function generateQuoteNotifications(
  payload: QuoteNotificationPrompt
): Promise<QuoteNotificationSuggestion[]> {
  if (!openai) {
    console.warn('[QuoteNotifications] OPENAIAPIKEY not set. Skipping generation.');
    return [];
  }

  const prompt = buildPrompt(payload);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.4,
    max_tokens: 700,
    messages: [
      {
        role: 'system',
        content:
          'You turn raw tweet engagement data into short, celebratory notifications. Always respond with JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() || '[]';

  const parsed = extractJsonArray(raw) as Array<{
    engagement_ids?: string[];
    notification?: string;
    sentiment?: SentimentLabel;
  }>;

  return parsed
    .filter(
      (item): item is Required<typeof item> =>
        Array.isArray(item.engagement_ids) &&
        item.engagement_ids.length > 0 &&
        typeof item.notification === 'string' &&
        !!item.notification.trim() &&
        (item.sentiment === 'positive' || item.sentiment === 'neutral' || item.sentiment === 'critical')
    )
    .map((item) => ({
      engagementIds: item.engagement_ids!,
      notification: item.notification!.trim(),
      sentiment: item.sentiment!,
    }));
}

