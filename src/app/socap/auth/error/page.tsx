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
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-stone-200">
        {/* Error Icon */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-500"
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
        <h1 className="text-2xl font-bold text-stone-800 mb-2">
          Connection Failed
        </h1>

        {/* Error Message */}
        <div className="bg-red-50 rounded-xl p-4 mb-6 border border-red-100">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>

        {/* Help Text */}
        <p className="text-stone-600 mb-6">
          This might happen if you denied the authorization request or if the link has expired.
        </p>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full py-3 px-4 bg-stone-900 text-white rounded-xl font-medium 
                       hover:bg-stone-800 transition-all duration-200"
          >
            Try Again
          </button>
          <button
            onClick={() => window.close()}
            className="w-full py-3 px-4 bg-stone-100 text-stone-700 rounded-xl font-medium 
                       hover:bg-stone-200 transition-all duration-200"
          >
            Close Window
          </button>
        </div>

        {/* Footer note */}
        <p className="text-xs text-stone-400 mt-4">
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
