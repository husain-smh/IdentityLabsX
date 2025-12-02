#!/usr/bin/env node

/**
 * Auto Sync Low-Follower Important People
 *
 * - Finds important_people entries that are:
 *   - is_active: true
 *   - last_synced: null (never synced)
 * - For each person:
 *   - Calls twitterapi.io /twitter/user/info to get their follower count
 *   - If followers > FOLLOWER_THRESHOLD (default: 6000) -> skip
 *   - If followers <= FOLLOWER_THRESHOLD -> calls existing Next.js API
 *     POST /api/ranker/admin/sync-person with { username }
 *   - Waits for that sync to complete before continuing
 *
 * Usage:
 *   npx tsx scripts/auto-sync-low-followers.ts
 *
 * Requirements:
 *   - NEXT server running (so /api/ranker/admin/sync-person is reachable)
 *   - Env vars:
 *       MONGODB_URI
 *       TWITTER_API_KEY
 *       AUTO_SYNC_BASE_URL (optional, defaults to http://localhost:3000)
 */

import rankerDbPromise from '../src/lib/mongodb-ranker';
import type { ImportantPerson } from '../src/lib/models/ranker';
import { getTwitterApiConfig } from '../src/lib/config/twitter-api-config';

const FOLLOWER_THRESHOLD = 6000;
const BASE_URL = process.env.AUTO_SYNC_BASE_URL || 'http://localhost:3000';

interface SyncPersonApiResult {
  username: string;
  success: boolean;
  message: string;
  following_count?: number;
  synced_at?: string | Date;
  error?: string;
}

interface SyncPersonApiResponse {
  success: boolean;
  message: string;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
  results: SyncPersonApiResult[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFollowerCount(username: string): Promise<number | null> {
  const config = getTwitterApiConfig();

  if (!config.apiKey) {
    console.error('❌ TWITTER_API_KEY not configured in environment.');
    return null;
  }

  try {
    const url = new URL(`${config.apiUrl}/twitter/user/info`);
    url.searchParams.set('userName', username);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        `❌ Failed to fetch user info for @${username}. Status: ${response.status}`,
      );
      const text = await response.text().catch(() => '');
      if (text) {
        console.error('   Response body:', text);
      }
      return null;
    }

    const data = (await response.json()) as any;
    const followers = data?.data?.followers;

    if (typeof followers === 'number') {
      return followers;
    }

    const parsed = parseInt(String(followers ?? '0'), 10);
    if (Number.isNaN(parsed)) {
      console.error(
        `❌ Could not parse followers for @${username}. Raw value:`,
        followers,
      );
      return null;
    }

    return parsed;
  } catch (error) {
    console.error(`❌ Error fetching follower count for @${username}:`, error);
    return null;
  }
}

async function triggerSync(username: string): Promise<SyncPersonApiResult | null> {
  const endpoint = `${BASE_URL}/api/ranker/admin/sync-person`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      console.error(
        `❌ Sync API returned non-OK status for @${username}: ${response.status}`,
      );
      const text = await response.text().catch(() => '');
      if (text) {
        console.error('   Response body:', text);
      }
      return null;
    }

    const data = (await response.json()) as SyncPersonApiResponse;
    const result = data.results?.[0];

    if (!result) {
      console.error(
        `❌ Sync API response did not contain results for @${username}. Full response:`,
        data,
      );
      return null;
    }

    return result;
  } catch (error) {
    console.error(`❌ Error calling sync API for @${username}:`, error);
    return null;
  }
}

async function main() {
  console.log('🚀 Auto Sync Low-Follower Important People');
  console.log('-------------------------------------------');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Follower threshold: ${FOLLOWER_THRESHOLD}`);
  console.log('');

  try {
    const db = await rankerDbPromise;
    const collection = db.collection<ImportantPerson>('important_people');

    // Find unsynced important people (last_synced: null)
    const cursor = collection
      .find({
        is_active: true,
        last_synced: null,
      })
      .sort({ created_at: 1 });

    const totalToCheck = await cursor.count();
    if (totalToCheck === 0) {
      console.log('✅ No unsynced important people found (last_synced is null).');
      process.exit(0);
    }

    console.log(
      `Found ${totalToCheck} unsynced important people (is_active: true, last_synced: null).`,
    );
    console.log('');

    let processed = 0;
    let skippedHighFollowers = 0;
    let synced = 0;
    let failed = 0;
    let followerLookupFailed = 0;

    while (await cursor.hasNext()) {
      const person = await cursor.next();
      if (!person) break;

      processed += 1;
      const username = person.username;

      console.log(
        `\n[${processed}/${totalToCheck}] Checking @${username} (created_at: ${person.created_at})`,
      );

      // 1) Fetch follower count from twitterapi.io
      const followers = await fetchFollowerCount(username);
      if (followers === null) {
        console.log(
          `   ⚠️  Skipping @${username} because follower count lookup failed.`,
        );
        followerLookupFailed += 1;
        continue;
      }

      console.log(`   Followers: ${followers}`);

      // 2) Apply threshold
      if (followers > FOLLOWER_THRESHOLD) {
        console.log(
          `   ⏭️  Skipping @${username} (followers ${followers} > ${FOLLOWER_THRESHOLD}).`,
        );
        skippedHighFollowers += 1;
        continue;
      }

      // 3) Trigger sync via existing API
      console.log(
        `   🔄 Triggering sync for @${username} (followers ${followers} <= ${FOLLOWER_THRESHOLD})...`,
      );
      const result = await triggerSync(username);

      if (!result) {
        console.log(
          `   ❌ Sync failed for @${username} (no result from API).`,
        );
        failed += 1;
      } else if (!result.success) {
        console.log(
          `   ❌ Sync failed for @${username}: ${result.message} (${result.error || 'no error detail'})`,
        );
        failed += 1;
      } else {
        console.log(
          `   ✅ Synced @${username}. Following count: ${
            result.following_count ?? 'unknown'
          }`,
        );
        synced += 1;
      }

      // Small delay between users to avoid hammering the Next.js API / N8N
      await sleep(500);
    }

    console.log('\n-------------------------------------------');
    console.log('🏁 Auto sync complete.');
    console.log(`   Processed:            ${processed}`);
    console.log(`   Synced successfully:  ${synced}`);
    console.log(`   Skipped (> threshold):${skippedHighFollowers}`);
    console.log(`   Follower lookup fail: ${followerLookupFailed}`);
    console.log(`   Sync failures:        ${failed}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error in auto-sync script:', error);
    process.exit(1);
  }
}

main();


