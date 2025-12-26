'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Home() {
  const tools = [
    {
      name: 'Quote Tweet Analytics',
      description: 'Analyze quote tweet engagement with precision metrics. Track viral content performance and influencer reach.',
      href: '/quotetweets',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      features: ['Real-time processing', 'Viral metrics', 'Top influencers'],
      gradient: 'from-indigo-500 to-purple-500'
    },
    {
      name: 'Tweet Engagement Analysis',
      description: 'Deep-dive into tweet engagement patterns. Export detailed user interaction data to Google Sheets.',
      href: '/twtengagement',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      features: ['Engagement tracking', 'User analysis', 'Sheets export'],
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      name: 'Importance Ranking System',
      description: 'Manage important people and rank tweet engagers by importance using inverse index lookup.',
      href: '/ranker',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      features: ['Important people sync', 'Following tracking', 'Importance scoring'],
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      name: 'Tweets Analyzed',
      description: 'View all analyzed tweets with engagement metrics. Track analysis status and results in real-time.',
      href: '/tweets',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      features: ['Analytics dashboard', 'Status tracking', 'Detailed results'],
      gradient: 'from-violet-500 to-purple-500'
    },
    {
      name: 'Monitored Tweets',
      description: 'Track real-time engagement metrics for tweets over 72 hours. View all active and completed monitoring jobs.',
      href: '/monitor',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      features: ['72h monitoring', 'Real-time metrics', 'Active jobs tracking'],
      gradient: 'from-pink-500 to-rose-500'
    }
  ];

  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <Navbar />
      {/* Background Pattern - Matching UserReport */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>

      <div className="relative z-10 origin-top-left scale-75" style={{ width: '133.33%', height: '133.33%' }}>
        {/* Header Section - Scaled 75% */}
        <div className="pt-20 pb-12">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h1 className="mb-4 text-4xl font-semibold leading-tight text-zinc-900 md:text-5xl">
              Identity Labs
              <br />
              <span className="text-zinc-500">Internal Tools.</span>
            </h1>
            
            <p className="mx-auto max-w-xl text-lg text-zinc-500">
              Analytics Tool for Identity Labs.
            </p>
          </div>
        </div>

        {/* Tools Grid - Scaled 75% */}
        <div className="mx-auto max-w-5xl px-6 pb-16">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, index) => (
              <Link key={index} href={tool.href}>
                <div className="group h-full cursor-pointer rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
                  <div className="flex h-full flex-col">
                    {/* Icon & Title */}
                    <div className="mb-4 flex items-start gap-3">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} transition-transform duration-300 group-hover:scale-110`}>
                        <div className="text-white">
                          {tool.icon}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-semibold text-zinc-900">
                          {tool.name}
                        </h2>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="mb-4 flex-grow text-sm leading-relaxed text-zinc-500">
                      {tool.description}
                    </p>

                    {/* Features */}
                    <div className="mb-4 space-y-1.5">
                      {tool.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-zinc-400">
                          <div className="h-1 w-1 rounded-full bg-zinc-300"></div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Action Button */}
                    <div className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 transition-all group-hover:gap-2">
                      <span>Open Tool</span>
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-zinc-200 py-6">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="text-xs text-zinc-400">
              Powered by Identity Labs • Advanced analytics for social intelligence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
