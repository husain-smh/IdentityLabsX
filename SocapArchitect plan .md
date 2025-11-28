1 - campaign setup takes the launch name, client info, list of tweet links that can be of 3 categories: main twt, influencer twt or investor twt., monitor window, and alert preferences. we resolve every link into a tweet id and store it in mongodb with empty checkpoints.

the scheduler reads the campaign doc every few minutes. it only runs jobs for campaigns marked active. the retweeter worker backfills a tweet once by paging through every retweet cursor it receives. on subsequent runs the worker just walks pages until it covers the delta since the last cursor (roughly delta/100 requests when pages are 100 items) because the freshest data always sits on the first pages.

metrics job hits the tweet metrics endpoint on its cadence. it compares the new counts to whatever we saved last time. the difference becomes the new impressions or likes for that time slice. we then store the fresh baseline back inside the tweet entry.

replies job calls the replies endpoint with the stored cursor. if the api gives a new cursor, we save it and keep going until has_next_page is false. every reply we see goes into the engagement collection keyed by tweet id plus author id so duplicates are ignored. quotes and retweeters work exactly the same way with their own cursors.

each new engager gets normalized info: action type, timestamp, text, account profile, importance score. we reuse the same keyword and weight logic from the single tweet report so the classifications stay consistent. future sentiment scoring will hook in as a separate service when we are ready.

aggregator service reads the stored events to build the outputs. cumulative likes or retweets charts sum the deltas per hour or day across all tweets. pie chart logic dedupes accounts per campaign and counts how many fall into investor, founder, ai, developer, media buckets. time series per profile simply group events by bucket and day.

the dashboard api serves these prepared aggregates and the latest engager list. we keep a small cache so the ui can refresh quickly without hammering the database.

alert worker listens for new events with high importance scores or strong sentiment. it sends notifications (slack or email) and records what it sent so we do not spam repeats inside the same half hour window.

every worker writes logs, last success time, and last cursor into mongodb so if a process dies we just restart and continue from the same spot. if an api cursor ever expires we reset it once and rely on the duplicate guard to avoid counting the same engagement twice.

after the monitor window ends we run a report job that freezes all metrics, calculates total cpm savings, and archives raw events for future audits. the campaign status flips to completed so the scheduler stops polling it.

database design and ingestion guarantees:

- storage layout: `campaigns` keep launch metadata, monitor window, alert prefs, and per-tweet checkpoints; `tweets` hold static tweet info plus latest metric snapshot; `engagements` is an append-friendly collection keyed by `tweet_id + user_id + action_type`; `worker_state` tracks each job’s last_success, cursor, and pending retries. all documents carry campaign_id so we can fan out and aggregate quickly.

- delta detection (56 → 76 retweeters): the worker stores each retweeter as an engagement document with a composite unique index on `tweet_id` and `user_id`. when the endpoint returns 76 ids, we bulk upsert; the 56 existing ones simply bump their `last_seen_at`, and the 20 new ones insert cleanly. because pages are returned newest-first, we can stop paging once we encounter a user whose `last_seen_at` is newer than the worker’s watermark, guaranteeing we only pay for the delta.

- scaling to ~400 tracked tweets: the scheduler never runs a giant monolith; it enqueues one job per tweet category (retweets, replies, quotes, metrics). `worker_state` stores an individualized cursor so every job just resumes where it left off. we shard campaigns by `campaign_id` (and optionally by tweet type) using Mongo’s hashed shard key so 400 tweets spread across workers without lock contention.

- rate limits and credit exhaustion: every job logs the exact cursor, request window, and metric baseline before making an external call. if we hit limit errors or recharge delays, the worker flips to a `blocked_until` timestamp in `worker_state` and exits gracefully. once credits return, it resumes by re-using the stored baseline and computing deltas from the buffered metrics so we never lose track of what was already counted.

- recording multiple engagements per important account: dedupe happens only inside a single tweet/action pair via the unique index. an investor who engages three different tweets will therefore have three engagement documents (one per tweet). downstream aggregators dedupe per campaign only when needed for “unique account” charts, but the raw history keeps every distinct touch so we can show that the account appeared on each tweet.
