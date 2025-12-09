'use client';

export default function SocapNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
        <span className="text-white font-semibold text-lg tracking-tight">Social Capital</span>
      </div>
    </nav>
  );
}

