'use client';

import { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import type { NetworkReachGroup } from '@/lib/user-report';

const COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F97316',
  '#22C55E',
  '#14B8A6',
  '#0EA5E9',
  '#F59E0B',
];

type Props = {
  groups: NetworkReachGroup[];
};

export function NetworkReachSection({ groups }: Props) {
  const pieData = useMemo(
    () =>
      groups.map((group) => ({
        name: group.role,
        value: group.engagers.length,
        category: group.category,
      })),
    [groups],
  );

  const [selectedCategory, setSelectedCategory] = useState(
    () => pieData[0]?.category ?? null,
  );

  const selectedGroup =
    groups.find((group) => group.category === selectedCategory) ?? null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={1}
                  onClick={(_, index) =>
                    setSelectedCategory(pieData[index]?.category ?? null)
                  }
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.category}`}
                      fill={COLORS[index % COLORS.length]}
                      className="cursor-pointer"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} profiles`, 'High-signal']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Click a slice to inspect the underlying accounts.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          {selectedGroup ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">
                  {selectedGroup.role}
                </p>
                <p className="text-sm text-zinc-500">
                  {selectedGroup.engagers.length} high-importance accounts
                </p>
              </div>
              <div className="grid gap-3">
                {selectedGroup.engagers.map((engager) => (
                  <div
                    key={engager.userId}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3"
                  >
                    <p className="text-sm font-semibold text-white">
                      {engager.name}{' '}
                      <span className="text-xs text-zinc-400">
                        @{engager.username}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      {engager.engagementTypes.length > 0
                        ? engager.engagementTypes.join(', ')
                        : 'latent interest'}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Importance {engager.importanceScore.toFixed(1)} ·{' '}
                      {Math.round(engager.followers).toLocaleString()} followers
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              Select a slice to see the underlying accounts.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


