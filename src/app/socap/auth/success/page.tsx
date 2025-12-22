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
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-stone-200">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-emerald-600"
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
        <h1 className="text-2xl font-bold text-stone-800 mb-2">
          You're Connected!
        </h1>

        {/* Connected Account Info */}
        {username && (
          <div className="bg-stone-50 rounded-xl p-4 mb-6 border border-stone-100">
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 bg-stone-900 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-stone-800">@{username}</p>
                {name && <p className="text-sm text-stone-500">{name}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        <p className="text-stone-600 mb-6">
          Your X account has been connected successfully. We'll start tracking engagement on your posts automatically.
        </p>

        {/* Close Button */}
        <button
          onClick={() => window.close()}
          className="w-full py-3 px-4 bg-stone-900 text-white rounded-xl font-medium 
                     hover:bg-stone-800 transition-all duration-200"
        >
          Close Window
        </button>

        {/* Footer note */}
        <p className="text-xs text-stone-400 mt-4">
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
