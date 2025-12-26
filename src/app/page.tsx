'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Home() {
  const tools = [
    {
      name: 'Quote Tweets',
      description: 'Analyze quote tweet engagement and viral content performance.',
      href: '/quotetweets',
    },
    {
      name: 'Engagement Analysis',
      description: 'Deep-dive into tweet engagement patterns and user interaction data.',
      href: '/twtengagement',
    },
    {
      name: 'Importance Ranker',
      description: 'Manage important people and rank tweet engagers.',
      href: '/ranker',
    },
    {
      name: 'Tweets Analyzed',
      description: 'View all analyzed tweets and their metrics.',
      href: '/tweets',
    },
    {
      name: 'Monitored Tweets',
      description: 'Track real-time engagement metrics over 72 hours.',
      href: '/monitor',
    }
  ];

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-[#2B2B2B] font-serif">
      <Navbar />

      <main className="relative pt-32 pb-20 px-6">
        {/* Header Section */}
        <div className="max-w-[800px] mx-auto text-center mb-24">
          <h1 className="text-[3.5rem] leading-[1.2] font-normal mb-8 text-[#2B2B2B]">
            Identity Labs
          </h1>
          
          <p className="text-[1.125rem] leading-[1.75] text-[#6B6B6B] max-w-[65ch] mx-auto">
            Analytics and intelligence tools.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tools.map((tool, index) => (
              <Link key={index} href={tool.href} className="group h-full">
                <div className="h-full bg-[#FEFEFE] border border-[#E8E4DF] p-8 transition-all duration-300 hover:border-[#2F6FED]">
                  <div className="flex flex-col h-full">
                    <h2 className="text-[1.5rem] leading-[1.5] font-normal text-[#2B2B2B] mb-4 group-hover:underline decoration-1 underline-offset-4">
                      {tool.name}
                    </h2>

                    <p className="text-[#6B6B6B] text-[1.125rem] leading-[1.75] flex-grow">
                      {tool.description}
                    </p>

                    <div className="mt-8 pt-6 border-t border-[#E8E4DF] flex items-center justify-between text-sm text-[#2B2B2B]">
                      <span>Access Tool</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-32 py-12 border-t border-[#E8E4DF] text-center">
          <p className="text-[#6B6B6B] text-sm">
            Identity Labs
          </p>
        </div>
      </main>
    </div>
  );
}
