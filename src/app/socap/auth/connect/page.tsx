'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';

/**
 * OAuth Connect Landing Page
 * 
 * A clean, simple page that explains what we need and why.
 * Client clicks "Connect" and gets redirected to Twitter OAuth.
 * 
 * URL: /socap/auth/connect?client=johndoe
 */

function ConnectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = searchParams.get('client');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    if (!clientId) return;
    setIsConnecting(true);
    // Redirect to the authorize endpoint
    window.location.href = `/api/socap/auth/twitter/authorize?client=${encodeURIComponent(clientId)}`;
  };

  // No client ID provided - show error
  if (!clientId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-stone-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-800 mb-2">Invalid Link</h1>
          <p className="text-stone-600">
            This authorization link is missing required information. Please contact support for a valid link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full border border-stone-200">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-stone-900 rounded-xl flex items-center justify-center mx-auto mb-3">
            {/* X/Twitter Logo */}
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-stone-800 mb-1">
            Connect Your X Account
          </h1>
          <p className="text-stone-600 text-sm">
            We need access to track engagement on your posts.
          </p>
        </div>

        {/* What we access */}
        <div className="mb-5">
          <h3 className="text-xs font-medium text-stone-700 mb-2">What we'll access:</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-stone-600">
              <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs">Users who liked your posts</span>
            </div>
            <div className="flex items-center gap-2.5 text-stone-600">
              <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs">Your public profile information</span>
            </div>
          </div>
        </div>

        {/* What we DON'T do */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-stone-700 mb-2">What we'll never do:</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-stone-500">
              <div className="w-4 h-4 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-xs">Post or tweet on your behalf</span>
            </div>
            <div className="flex items-center gap-2.5 text-stone-500">
              <div className="w-4 h-4 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-xs">Access your direct messages</span>
            </div>
            <div className="flex items-center gap-2.5 text-stone-500">
              <div className="w-4 h-4 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-xs">Follow or unfollow accounts</span>
            </div>
          </div>
        </div>

        {/* Connect Button */}
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full py-2.5 px-4 bg-stone-900 text-white rounded-lg font-medium text-sm
                     hover:bg-stone-800 transition-all duration-200 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {isConnecting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Connect with X</span>
            </>
          )}
        </button>

        {/* Footer note */}
        <p className="text-[10px] text-stone-400 text-center mt-3">
          You can revoke access at any time from your X settings.
        </p>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-stone-300 border-t-stone-800 rounded-full"></div>
      </div>
    }>
      <ConnectContent />
    </Suspense>
  );
}
