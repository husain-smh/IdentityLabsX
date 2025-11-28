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
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
        <div className="relative z-10 pt-28">
          <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-center shadow-2xl">
            <p className="text-lg font-semibold text-white">No aggregated data yet</p>
            <p className="text-sm text-zinc-400">
              We couldn’t find any analyzed tweets for “{identifier}”. Double-check the handle or try
              again after running a tweet analysis.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/tweets"
                className="rounded-full bg-indigo-500/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Browse tweets
              </Link>
              <Link
                href="/monitor"
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
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

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
      <div className="relative z-10">
        <div className="pt-24 pb-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Aggregated footprint</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">
                {report.author.name}{' '}
                {report.author.username ? (
                  <span className="text-2xl text-zinc-400">
                    (@{report.author.username.replace('@', '')})
                  </span>
                ) : null}
              </h1>
              <p className="mt-3 text-sm text-zinc-400">
                Every manually analyzed tweet details.
              </p>
            </div>

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


