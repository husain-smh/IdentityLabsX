import { resolveTweetUrls } from './tweet-resolver';
import { getCampaignTweetsCollection, CampaignTweet } from '../models/socap/tweets';
import { getWorkerStateCollection } from '../models/socap/worker-state';
import { getJobQueueCollection } from '../socap/job-queue';
import { getEngagementsCollection } from '../models/socap/engagements';
import { getMetricSnapshotsCollection } from '../models/socap/metric-snapshots';

type TweetCategory = 'main_twt' | 'influencer_twt' | 'investor_twt';

interface UrlEntry {
  url: string;
}

export interface SyncCampaignTweetsInput {
  campaignId: string;
  maintweets: UrlEntry[];
  influencer_twts: UrlEntry[];
  investor_twts: UrlEntry[];
}

/**
 * Sync campaign tweets (main/influencer/investor) with a new set of URLs.
 *
 * - Adds new tweets (resolves URL → tweet_id, creates CampaignTweet)
 * - Removes tweets that are no longer present:
 *   - Deletes from socap_tweets
 *   - Deletes worker_state rows for that (campaign,tweet)
 *   - Deletes pending/retrying jobs for that (campaign,tweet)
 *   - Deletes engagements for that (campaign,tweet)
 *   - Deletes all metric snapshots for the campaign (so charts no longer include old tweets)
 *
 * NOTE: Metric snapshots are aggregated; to guarantee removed tweets don't show up
 * in historical charts, we currently clear all snapshots for the campaign.
 */
export async function syncCampaignTweets(input: SyncCampaignTweetsInput): Promise<{
  added: number;
  removed: number;
  updatedCategory: number;
}> {
  const { campaignId, maintweets, influencer_twts, investor_twts } = input;

  // 1) Build desired map: tweet_url -> category
  const desiredUrlMap = new Map<string, TweetCategory>();

  const addUrlsToMap = (entries: UrlEntry[], category: TweetCategory) => {
    for (const entry of entries) {
      const cleanUrl = entry.url?.trim();
      if (!cleanUrl) continue;
      desiredUrlMap.set(cleanUrl, category);
    }
  };

  addUrlsToMap(maintweets || [], 'main_twt');
  addUrlsToMap(influencer_twts || [], 'influencer_twt');
  addUrlsToMap(investor_twts || [], 'investor_twt');

  if (desiredUrlMap.size === 0) {
    throw new Error('At least one tweet URL is required when syncing campaign tweets');
  }

  const tweetCollection = await getCampaignTweetsCollection();

  // 2) Load current tweets for campaign
  const currentTweets = await tweetCollection
    .find({ campaign_id: campaignId })
    .toArray();

  const currentByUrl = new Map<string, CampaignTweet>();
  for (const t of currentTweets) {
    if (t.tweet_url) {
      currentByUrl.set(t.tweet_url, t);
    }
  }

  // 3) Resolve all desired URLs to tweet IDs (for adds)
  const desiredUrls = Array.from(desiredUrlMap.keys());
  const resolved = await resolveTweetUrls(desiredUrls);

  const resolvedByUrl = new Map<string, typeof resolved[0]>();
  for (const r of resolved) {
    resolvedByUrl.set(r.tweet_url, r);
  }

  let added = 0;
  let removed = 0;
  let updatedCategory = 0;

  // 4) Handle removals: tweets present in DB but not in desiredUrlMap
  const tweetsToRemove: CampaignTweet[] = [];
  for (const t of currentTweets) {
    if (!desiredUrlMap.has(t.tweet_url)) {
      tweetsToRemove.push(t);
    }
  }

  if (tweetsToRemove.length > 0) {
    const tweetIds = tweetsToRemove.map((t) => t.tweet_id);

    const workerStateCollection = await getWorkerStateCollection();
    const jobQueueCollection = await getJobQueueCollection();
    const engagementsCollection = await getEngagementsCollection();
    const metricSnapshotsCollection = await getMetricSnapshotsCollection();

    // Delete tweets
    await tweetCollection.deleteMany({
      campaign_id: campaignId,
      tweet_id: { $in: tweetIds },
    });

    // Delete worker state rows for these tweets
    await workerStateCollection.deleteMany({
      campaign_id: campaignId,
      tweet_id: { $in: tweetIds },
    });

    // Delete jobs for these tweets (any status)
    await jobQueueCollection.deleteMany({
      campaign_id: campaignId,
      tweet_id: { $in: tweetIds },
    });

    // Delete engagements tied to these tweets
    await engagementsCollection.deleteMany({
      campaign_id: campaignId,
      tweet_id: { $in: tweetIds },
    });

    // Delete all metric snapshots for this campaign to remove historical contribution
    await metricSnapshotsCollection.deleteMany({
      campaign_id: campaignId,
    });

    removed = tweetsToRemove.length;
  }

  // 5) Handle additions and category updates
  for (const [url, category] of desiredUrlMap.entries()) {
    const existing = currentByUrl.get(url);
    const resolvedTweet = resolvedByUrl.get(url);

    if (!resolvedTweet) {
      // If URL failed to resolve (invalid or API error), skip it
      // Caller can decide how to surface this later if needed
      continue;
    }

    if (!existing) {
      // New tweet: insert into socap_tweets
      const newTweet: Omit<CampaignTweet, '_id'> = {
        campaign_id: campaignId,
        tweet_id: resolvedTweet.tweet_id,
        tweet_url: resolvedTweet.tweet_url,
        text: resolvedTweet.text,
        category,
        author_name: resolvedTweet.author_name,
        author_username: resolvedTweet.author_username,
        metrics: {
          likeCount: 0,
          retweetCount: 0,
          quoteCount: 0,
          replyCount: 0,
          viewCount: 0,
          quoteViewsFromQuotes: 0,
          bookmarkCount: 0,
          last_updated: null,
        },
        created_at: new Date(),
      };

      await tweetCollection.insertOne(newTweet);
      added += 1;
    } else if (existing.category !== category) {
      // Category changed: update in-place
      await tweetCollection.updateOne(
        { _id: (existing as any)._id },
        { $set: { category } }
      );
      updatedCategory += 1;
    }
  }

  return { added, removed, updatedCategory };
}


