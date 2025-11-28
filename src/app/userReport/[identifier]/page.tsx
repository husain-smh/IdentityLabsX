import Link from 'next/link';

import Navbar from '@/components/Navbar';
import { NetworkReachSection } from '@/app/userReport/_components/NetworkReachSection';
import { FollowerTierChart } from '@/app/userReport/_components/FollowerTierChart';
import { getUserReport } from '@/lib/user-report';

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const standardNumber = new Intl.NumberFormat('en-US');

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatCompact(value: number) {
  return compactNumber.format(value);
}

function formatPercent(value: number) {
  return `${percentFormatter.format(value)}%`;
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

type SectionProps = {
  title: string;
  description?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

type PostMetricKey =
  | 'replies'
  | 'retweets'
  | 'likes'
  | 'bookmarks'
  | 'quotes'
  | 'views'
  | 'totalEngagers';

function CollapsibleSection({
  title,
  description,
  badge,
  defaultOpen = true,
  children,
}: SectionProps) {
  return (
    <details
      className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-[0_20px_120px_rgba(0,0,0,0.45)]"
      open={defaultOpen}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 text-white"
        style={{ listStyle: 'none' }}
      >
        <div>
          {badge ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
              {badge}
            </p>
          ) : null}
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          ) : null}
        </div>
        <svg
          className="h-5 w-5 text-zinc-500 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-6 pb-6">{children}</div>
    </details>
  );
}

interface PageParams {
  identifier: string;
}

export default async function UserReportPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { identifier } = await params;
  const report = await getUserReport(identifier);

  if (!report) {
    return (
      <div className="relative min-h-screen bg-white text-zinc-900">
        <Navbar />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
        <div className="relative z-10 pt-28">
          <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-2xl">
            <p className="text-lg font-semibold text-zinc-900">No aggregated data yet</p>
            <p className="text-sm text-zinc-500">
              We couldn’t find any analyzed tweets for “{identifier}”. Double-check the handle or try
              again after running a tweet analysis.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/tweets"
                className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500/90"
              >
                Browse tweets
              </Link>
              <Link
                href="/monitor"
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Monitor new tweet
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const metricEntries = [
    { label: 'Total Likes', value: report.metricTotals.likes },
    { label: 'Total Retweets', value: report.metricTotals.retweets },
    { label: 'Total Quotes', value: report.metricTotals.quotes },
    { label: 'Total Replies', value: report.metricTotals.replies },
    { label: 'Total Views', value: report.metricTotals.views },
    { label: 'Total Bookmarks', value: report.metricTotals.bookmarks },
  ];

  const engagementBasics = [
    {
      label: 'Total engagements logged',
      value: standardNumber.format(report.engagers.totalEngagements),
    },
    {
      label: 'Unique engagers',
      value: standardNumber.format(report.engagers.uniqueEngagers),
    },
    {
      label: 'Repeat engagements',
      value: standardNumber.format(report.engagers.repeatEngagements),
      helper:
        report.engagers.totalEngagements > 0
          ? `${formatPercent(
              (report.engagers.repeatEngagements / report.engagers.totalEngagements) * 100,
            )} of all engagements`
          : undefined,
    },
  ];

  const verificationStats = [
    {
      label: 'Verified accounts',
      value: standardNumber.format(report.engagers.verifiedCount),
    },
    {
      label: 'Non-verified accounts',
      value: standardNumber.format(report.engagers.nonVerifiedCount),
    },
    {
      label: '≥10K followers',
      value: `${standardNumber.format(report.engagers.highFollowerCount)} · ${formatPercent(
        report.engagers.highFollowerShare,
      )}`,
      helper: report.engagers.topFollowerTier
        ? `Top tier observed: ${report.engagers.topFollowerTier}`
        : undefined,
    },
  ];

  const engagementMix = [
    { label: 'Replied at least once', value: formatPercent(report.engagers.engagementMix.repliedPct) },
    {
      label: 'Retweeted at least once',
      value: formatPercent(report.engagers.engagementMix.retweetedPct),
    },
    { label: 'Quoted at least once', value: formatPercent(report.engagers.engagementMix.quotedPct) },
  ];

  const importanceStats = [
    {
      label: 'Average importance score',
      value: report.engagers.importance.average.toFixed(2),
    },
    {
      label: 'Max importance score',
      value: report.engagers.importance.max.toFixed(2),
    },
    {
      label: 'High-signal profiles counted',
      value: standardNumber.format(report.engagers.importance.population),
    },
  ];

  const hasTimeline = report.timeline.points.length > 0;
  const hasMomentum = report.timeline.momentum.length > 0;

  const postMetricConfig: {
    key: PostMetricKey;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'replies' as const,
      label: 'Replies',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M3 10v8a2 2 0 0 0 2 2h3v3l4-3h7a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'retweets' as const,
      label: 'Retweets',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="m17 2 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 6h18M7 22l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 18H3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'likes' as const,
      label: 'Likes',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12 21s-6.5-4.35-9-8.4C1.2 9.6 2 6 5.5 5.1A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 6.5-1.9C22 6 22.8 9.6 21 12.6 18.5 16.65 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'bookmarks' as const,
      label: 'Bookmarks',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M6 3h12v18l-6-4.5L6 21Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'quotes' as const,
      label: 'Quotes',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M7 7h6v6H7zM13 11h4v6h-4z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 17h4M15 7h4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'views' as const,
      label: 'Views',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      key: 'totalEngagers' as const,
      label: 'Engagers',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <Navbar />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>
      <div className="relative z-10">
        <div className="pt-24 pb-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-2xl">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Aggregated footprint</p>
              <h1 className="mt-3 text-4xl font-semibold text-zinc-900">
                {report.author.name}{' '}
                {report.author.username ? (
                  <span className="text-2xl text-zinc-500">
                    (@{report.author.username.replace('@', '')})
                  </span>
                ) : null}
              </h1>
              <p className="mt-3 text-sm text-zinc-500">
                Every manually analyzed tweet details.
              </p>
            </div>

            {hasTimeline ? (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-white/95 p-6 text-zinc-900 shadow-2xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-2xl font-semibold text-zinc-900">Posts</h3>
                    <p className="text-sm text-zinc-500">Analyzed tweet details.</p>
                  </div>
                  <div className="hidden items-center gap-2 text-xs font-semibold text-indigo-500 sm:flex">
                    <svg width="17" height="17" viewBox="0 0 60 76" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M40.9144 42.5043C41.2343 41.6144 40.9743 41.3345 40.0645 41.6244V41.6144C36.8749 42.6343 31.3456 44.0341 24.9865 42.7843C23.6567 42.5143 23.7367 41.4945 25.0865 41.4245C30.1258 41.1745 38.0047 40.0347 42.2542 35.6652C45.3503 32.4812 47.0048 27.6113 48.8466 22.1899C50.9841 15.8984 53.3739 8.86405 58.562 2.85962C58.6862 2.71513 58.8336 2.56132 58.9853 2.40288C60.031 1.3114 61.2873 0 56.6423 0C33.1845 0 24.678 18.9364 10.3822 50.7606C7.85393 56.3887 5.14463 62.42 2.13953 68.8208C1.88318 69.3646 1.62616 69.8836 1.38357 70.3734C0.689452 71.7749 0.113548 72.9377 0.00981892 73.7602C-0.0701704 74.4401 0.339775 75 1.14967 75C3.95021 74.9725 6.77916 70.0202 9.40189 65.4289C10.5902 63.3486 11.7363 61.3424 12.8181 59.902C14.2079 58.0522 15.5677 57.1924 17.2875 56.7424C18.6405 56.3819 20.1448 56.2122 21.7419 56.0319C23.5556 55.8272 25.4889 55.609 27.4562 55.0826C35.2251 53.0029 39.2446 47.2237 40.9144 42.5043ZM55.7925 67.9509C55.7925 71.8304 52.6429 74.98 48.7635 74.98C44.884 74.98 41.7344 71.8304 41.7344 67.9509C41.7344 64.0714 44.884 60.9219 48.7635 60.9219C52.6429 60.9219 55.7925 64.0714 55.7925 67.9509Z"
                        fill="currentColor"
                      ></path>
                    </svg>
                    <span>.</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[960px]">
                    <div className="sticky top-0 z-10 grid grid-cols-[280px_repeat(7,minmax(80px,1fr))_36px] border-b border-zinc-200 bg-white px-4 py-2 text-center text-xs font-semibold text-zinc-500 backdrop-blur">
                      <div className="text-left text-zinc-500">Tweet</div>
                      {postMetricConfig.map((metric) => (
                        <div
                          key={metric.key}
                          className="flex items-center justify-center gap-1 text-zinc-500"
                          title={metric.label}
                        >
                          <span className="text-indigo-500">{metric.icon}</span>
                        </div>
                      ))}
                      <div></div>
                    </div>
                    <div>
                      {[...report.timeline.points]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((point) => (
                          <div
                            key={point.tweetId}
                            className="grid grid-cols-[280px_repeat(7,minmax(80px,1fr))_36px] items-center border-b border-zinc-200 px-4 py-4 text-center text-sm text-zinc-600"
                          >
                            <div className="text-left">
                              <div className="rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
                                <div className="text-left text-sm text-zinc-700 line-clamp-2">
                                  <span className="font-semibold text-zinc-900">Tweet {point.tweetId}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                                  <span>{formatDate(point.createdAt)}</span>
                                  <span>•</span>
                                  <a
                                    href={point.tweetUrl}
                                    className="text-indigo-500 hover:text-indigo-400 hover:underline"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    View
                                  </a>
                                </div>
                              </div>
                            </div>
                            {postMetricConfig.map((metric) => {
                              const value =
                                metric.key === 'totalEngagers'
                                  ? point.totalEngagers
                                  : metric.key === 'views'
                                    ? point.views
                                    : metric.key === 'likes'
                                      ? point.likes
                                      : metric.key === 'retweets'
                                        ? point.retweets
                                        : metric.key === 'replies'
                                          ? point.replies
                                          : metric.key === 'bookmarks'
                                            ? point.bookmarks
                                            : point.quotes;
                              return (
                                <div key={metric.key} className="text-sm font-semibold text-zinc-900">
                                  {typeof value === 'number' ? formatCompact(value) : '—'}
                                </div>
                              );
                            })}
                            <div className="flex items-center justify-center">
                              <Link
                                href={`/tweets/${point.tweetId}`}
                                className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700"
                                aria-label="Open tweet"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="12" cy="12" r="1"></circle>
                                  <circle cx="19" cy="12" r="1"></circle>
                                  <circle cx="5" cy="12" r="1"></circle>
                                </svg>
                              </Link>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <CollapsibleSection
              badge="Engagement totals"
              title="Cumulative tweet performance"
              description="Direct sums of raw Twitter metrics across every analyzed tweet."
            >
              <div className="grid gap-4 md:grid-cols-3">
                {metricEntries.map((entry) => (
                  <div
                    key={entry.label}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                  >
                    <p className="text-xs uppercase tracking-wide text-zinc-400">{entry.label}</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {formatCompact(entry.value)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {standardNumber.format(entry.value)} exact
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              badge="Engager intelligence"
              title="Audience duplication & quality"
              description="Deduplicated at the userId level to show true reach."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                  <h3 className="text-xs uppercase tracking-wide text-zinc-400">Volume</h3>
                  <div className="space-y-3">
                    {engagementBasics.map((entry) => (
                      <div key={entry.label}>
                        <p className="text-xs text-zinc-500">{entry.label}</p>
                        <p className="text-2xl font-semibold text-white">{entry.value}</p>
                        {entry.helper ? (
                          <p className="text-xs text-zinc-500">{entry.helper}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                  <h3 className="text-xs uppercase tracking-wide text-zinc-400">Verification & tiers</h3>
                  <div className="space-y-3">
                    {verificationStats.map((entry) => (
                      <div key={entry.label}>
                        <p className="text-xs text-zinc-500">{entry.label}</p>
                        <p className="text-2xl font-semibold text-white">{entry.value}</p>
                        {entry.helper ? (
                          <p className="text-xs text-zinc-500">{entry.helper}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                  <h3 className="text-xs uppercase tracking-wide text-zinc-400">Engagement mix</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {engagementMix.map((entry) => (
                      <div key={entry.label}>
                        <p className="text-xs text-zinc-500">{entry.label}</p>
                        <p className="text-2xl font-semibold text-white">{entry.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                  <h3 className="text-xs uppercase tracking-wide text-zinc-400">Importance signals</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {importanceStats.map((entry) => (
                      <div key={entry.label}>
                        <p className="text-xs text-zinc-500">{entry.label}</p>
                        <p className="text-2xl font-semibold text-white">{entry.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <h3 className="text-xs uppercase tracking-wide text-zinc-400">
                  Notable followers referencing this author
                </h3>
                {report.engagers.notableFollowers.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.engagers.notableFollowers.map((handle) => (
                      <span
                        key={handle}
                        className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-medium text-white"
                      >
                        @{handle}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">
                    No tracked “followed_by” mentions yet.
                  </p>
                )}
              </div>

              <div className="mt-6">
                <FollowerTierChart tiers={report.engagers.followerTiers} />
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              badge="Network reach"
              title="High-importance engagers by role"
              description="Pie slice shows each role’s share. Click to inspect the accounts."
            >
              {report.networkReach.totalHighImportance === 0 ? (
                <p className="text-sm text-zinc-400">
                  None of the deduped engagers have an importance score yet.
                </p>
              ) : (
                <NetworkReachSection groups={report.networkReach.groups} />
              )}
            </CollapsibleSection>

            <CollapsibleSection
              badge="Temporal dynamics"
              title="How each launch performed in sequence"
              description="Raw per-tweet stats plus a rolling average to highlight consistency."
            >
              {hasTimeline ? (
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
                    <table className="w-full table-auto text-sm">
                      <thead className="bg-zinc-900/80 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        <tr>
                          <th className="px-4 py-3">Tweet</th>
                          <th className="px-4 py-3">Published</th>
                          <th className="px-4 py-3">Engagers</th>
                          <th className="px-4 py-3">Views</th>
                          <th className="px-4 py-3">Likes</th>
                          <th className="px-4 py-3">Quotes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.timeline.points.map((point) => (
                          <tr key={point.tweetId} className="border-t border-zinc-800">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <Link
                                  href={`/tweets/${point.tweetId}`}
                                  className="text-sm font-semibold text-white hover:underline"
                                >
                                  {point.tweetId}
                                </Link>
                                <a
                                  href={point.tweetUrl}
                                  className="text-xs text-zinc-500 hover:underline"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View tweet
                                </a>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-zinc-500">{formatDate(point.createdAt)}</td>
                            <td className="px-4 py-3 font-semibold text-white">
                              {standardNumber.format(point.totalEngagers)}
                            </td>
                            <td className="px-4 py-3">
                              {point.views !== null ? standardNumber.format(point.views) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {point.likes !== null ? standardNumber.format(point.likes) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {point.quotes !== null ? standardNumber.format(point.quotes) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {hasMomentum ? (
                    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
                      <table className="w-full table-auto text-sm">
                        <thead className="bg-zinc-900/80 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                          <tr>
                            <th className="px-4 py-3">Window ending</th>
                            <th className="px-4 py-3">Rolling engagers (3 tweet avg)</th>
                            <th className="px-4 py-3">Rolling views (if available)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.timeline.momentum.map((point) => (
                            <tr key={`${point.tweetId}-momentum`} className="border-t border-zinc-800">
                              <td className="px-4 py-3 text-zinc-500">{formatDate(point.createdAt)}</td>
                              <td className="px-4 py-3 font-semibold text-white">
                                {standardNumber.format(point.rollingEngagers)}
                              </td>
                              <td className="px-4 py-3">
                                {point.rollingViews !== null
                                  ? standardNumber.format(point.rollingViews)
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-zinc-400">
                  No per-tweet metrics yet. Re-run tweet analysis to populate this view.
                </p>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              badge="AI reports"
              title="Narratives & backlog"
              description="Quick glance at which tweets already have structured write-ups."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Reports ready</p>
                    <p className="text-4xl font-semibold text-white">
                      {report.aiReports.completedCount}
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {report.aiReports.completedReports.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        No AI narratives have been generated yet.
                      </p>
                    ) : (
                      report.aiReports.completedReports.map((pointer) => (
                        <div key={pointer.tweetId} className="rounded-xl border border-zinc-800 p-3">
                          <div className="flex items-center justify-between">
                            <Link
                              href={`/tweets/${pointer.tweetId}`}
                              className="text-sm font-semibold text-white hover:underline"
                            >
                              Tweet {pointer.tweetId}
                            </Link>
                            <span className="text-xs text-zinc-500">
                              {pointer.analyzedAt ? formatDate(pointer.analyzedAt) : '—'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {pointer.summarySnippet ||
                              'Report ready – open tweet view for the write-up.'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Insights backlog</p>
                    <p className="text-4xl font-semibold text-white">
                      {report.aiReports.backlogCount}
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {report.aiReports.backlog.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        Nothing pending – every tweet has an AI write-up.
                      </p>
                    ) : (
                      report.aiReports.backlog.map((pointer) => (
                        <div key={pointer.tweetId} className="rounded-xl border border-zinc-800 p-3">
                          <div className="flex items-center justify-between">
                            <Link
                              href={`/tweets/${pointer.tweetId}`}
                              className="text-sm font-semibold text-white hover:underline"
                            >
                              Tweet {pointer.tweetId}
                            </Link>
                            <span className="text-xs text-zinc-500">{pointer.status}</span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            Created {formatDate(pointer.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </div>
  );
}


