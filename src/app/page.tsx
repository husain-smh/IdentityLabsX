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
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      features: ['Engagement tracking', 'User analysis', 'Sheets export'],
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      name: 'Engager Ranking System',
      description: 'Manage important people and rank tweet engagers by importance using inverse index lookup.',
      href: '/ranker',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      features: ['Analytics dashboard', 'Status tracking', 'Detailed results'],
      gradient: 'from-violet-500 to-purple-500'
    },
    {
      name: 'Monitored Tweets',
      description: 'Track real-time engagement metrics for tweets over 24 hours. View all active and completed monitoring jobs.',
      href: '/monitor',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      features: ['24h monitoring', 'Real-time metrics', 'Active jobs tracking'],
      gradient: 'from-pink-500 to-rose-500'
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative">
      <Navbar />
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-80" style={{ background: "radial-gradient(circle at 50% 20%, rgba(255,255,255,0.6), transparent 60%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 20% 80%, rgba(218,209,193,0.3), transparent 55%)" }} />

      <div className="relative z-10">
        {/* Header Section */}
        <div className="pt-24 pb-16">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h1 className="text-5xl md:text-6xl font-semibold mb-6 leading-tight text-[var(--foreground)] font-serif">
              Identity Labs
              <br />
              <span className="text-[var(--foreground)]/80">Internal Tools.</span>
            </h1>
            
            <p className="text-xl text-[var(--muted-foreground)] mb-8 max-w-2xl mx-auto leading-relaxed font-sans">
              Analytics Tool for Identity Labs.
            </p>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool, index) => (
              <Link key={index} href={tool.href}>
                <div className="glass rounded-2xl p-8 border border-[var(--border)] transition-all duration-300 group cursor-pointer h-full">
                  <div className="flex flex-col h-full">
                    {/* Icon & Title */}
                    <div className="flex items-start gap-4 mb-6">
                      <div className={`w-16 h-16 bg-gradient-to-br ${tool.gradient} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                        <div className="text-white">
                          {tool.icon}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
                          {tool.name}
                        </h2>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[var(--muted-foreground)] mb-6 leading-relaxed flex-grow">
                      {tool.description}
                    </p>

                    {/* Features */}
                    <div className="space-y-2 mb-6">
                      {tool.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]/80">
                          <div className="w-1.5 h-1.5 bg-[var(--muted-foreground)]/60 rounded-full"></div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Action Button */}
                    <div className="inline-flex items-center gap-2 text-[var(--foreground)] font-medium group-hover:gap-3 transition-all">
                      <span>Open Tool</span>
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="mt-20 py-8 border-t border-[var(--border)]/60">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <p className="text-[var(--muted-foreground)] text-sm">
              Powered by Identity Labs • Advanced analytics for social intelligence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
