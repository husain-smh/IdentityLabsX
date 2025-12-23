'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/**
 * OAuth Error Page
 * 
 * Shown when OAuth authorization fails.
 */

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'An unknown error occurred';

  const handleRetry = () => {
    // Go back to try again
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full text-center border border-stone-200">
        {/* Error Icon */}
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-stone-800 mb-1">
          Connection Failed
        </h1>

        {/* Error Message */}
        <div className="bg-red-50 rounded-lg p-3 mb-5 border border-red-100">
          <p className="text-xs text-red-700">
            {error}
          </p>
        </div>

        {/* Help Text */}
        <p className="text-stone-600 text-sm mb-5">
          This might happen if you denied the authorization request or if the link has expired.
        </p>

        {/* Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handleRetry}
            className="w-full py-2.5 px-4 bg-stone-900 text-white rounded-lg font-medium text-sm
                       hover:bg-stone-800 transition-all duration-200"
          >
            Try Again
          </button>
          <button
            onClick={() => window.close()}
            className="w-full py-2.5 px-4 bg-stone-100 text-stone-700 rounded-lg font-medium text-sm
                       hover:bg-stone-200 transition-all duration-200"
          >
            Close Window
          </button>
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-stone-400 mt-3">
          Need help? Contact support.
        </p>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-stone-300 border-t-stone-800 rounded-full"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
