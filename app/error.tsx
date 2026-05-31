"use client";

/**
 * Dashboard error boundary.
 * Catches runtime errors thrown during rendering and shows a recovery UI
 * that lets the user retry without a full page reload.
 */
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to console so Vercel's function logs capture it
    console.error("[MarketLens] Dashboard render error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-8">
        <svg
          className="w-6 h-6 text-sky-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <span className="text-sky-400 font-semibold tracking-tight text-lg">
          MarketLens
        </span>
      </div>

      {/* Error card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
        <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
          <svg
            className="w-5 h-5 text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-slate-100 text-sm font-semibold mb-1">
            Something went wrong
          </h1>
          <p className="text-slate-500 text-xs leading-relaxed">
            The dashboard encountered an unexpected error. Your data is safe —
            this is a display issue.
          </p>
        </div>

        {/* Error detail — only in dev */}
        {process.env.NODE_ENV === "development" && (
          <div className="bg-slate-950 rounded-lg px-4 py-3 text-left">
            <p className="text-rose-400 text-[10px] font-mono break-all leading-relaxed">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-slate-600 text-[9px] mt-1">
                digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-medium rounded-lg transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            Full page reload
          </button>
        </div>
      </div>

      <p className="text-slate-700 text-[10px] mt-6">
        If this persists, the issue will resolve after the next scheduled data refresh.
      </p>
    </div>
  );
}
