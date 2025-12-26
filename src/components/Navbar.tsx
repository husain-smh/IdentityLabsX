'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Quote Tweets', href: '/quotetweets' },
    { name: 'Engagement', href: '/twtengagement' },
    { name: 'Ranker', href: '/ranker' },
    { name: 'Tweets', href: '/tweets' },
    { name: 'Monitor', href: '/monitor' }
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F3F0] border-b border-[#E8E4DF] text-[#2B2B2B]">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center gap-2 group">
            <Image 
              src="/identity-labs-logo.png" 
              alt="Identity Labs Logo" 
              width={24} 
              height={24}
              className="object-contain"
            />
            <span className="font-serif text-lg text-[#2B2B2B] group-hover:text-[#6B6B6B] transition-colors">
              Identity Labs
            </span>
          </Link>

          {/* Navigation Items */}
          <div className="flex items-center gap-8 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-base font-serif transition-colors whitespace-nowrap border-b-2 py-1 ${
                    isActive
                      ? 'text-[#2B2B2B] border-[#2F6FED]'
                      : 'text-[#6B6B6B] border-transparent hover:text-[#2B2B2B] hover:border-[#E8E4DF]'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
