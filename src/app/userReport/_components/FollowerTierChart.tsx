'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

import type { FollowerTier } from '@/lib/user-report';

type Props = {
  tiers: FollowerTier[];
};

export function FollowerTierChart({ tiers }: Props) {
  if (!tiers || tiers.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No follower tier data yet. Re-run tweet analysis to populate this view.
      </p>
    );
  }

  const data = tiers.map((tier) => ({
    tier: tier.tier,
    count: tier.count,
  }));

  return (
    <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Follower Count Tiers</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="tier" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: 8,
            }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


