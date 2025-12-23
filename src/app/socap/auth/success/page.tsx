'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/**
 * OAuth Success Page
 * 
 * Shown after a client successfully authorizes their X account.
 * Displays their connected username and a message to close the tab.
 */

function SuccessContent() {
  const searchParams = useSearchParams();
  const username = searchParams.get('username');
  const name = searchParams.get('name');

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full text-center border border-stone-200">
        {/* Success Icon */}
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg
            className="w-6 h-6 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-stone-800 mb-1">
          You&apos;re Connected!
        </h1>

        {/* Connected Account Info */}
        {username && (
          <div className="bg-stone-50 rounded-lg p-3 mb-5 border border-stone-100">
            <div className="flex items-center justify-center gap-2.5">
              <div className="w-8 h-8 bg-stone-900 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-stone-800">@{username}</p>
                {name && <p className="text-xs text-stone-500">{name}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        <p className="text-stone-600 text-sm mb-5">
          Your X account has been connected successfully. We&apos;ll start tracking engagement on your posts automatically.
        </p>

        {/* Close Button */}
        <button
          onClick={() => window.close()}
          className="w-full py-2.5 px-4 bg-stone-900 text-white rounded-lg font-medium text-sm
                     hover:bg-stone-800 transition-all duration-200"
        >
          Close Window
        </button>

        {/* Footer note */}
        <p className="text-[10px] text-stone-400 mt-3">
          You can revoke access anytime from your X settings.
        </p>
      </div>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-stone-300 border-t-stone-800 rounded-full"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
