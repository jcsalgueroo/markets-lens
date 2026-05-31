import Link from "next/link";

/**
 * Dark-themed 404 page — consistent with the MarketLens dashboard aesthetic.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-10">
        <svg
          className="w-5 h-5 text-sky-400"
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
        <span className="text-sky-400 font-semibold tracking-tight">
          MarketLens
        </span>
      </div>

      {/* 404 card */}
      <div className="w-full max-w-sm text-center space-y-4">
        <p className="text-6xl font-bold text-slate-800 tabular-nums tracking-tight">
          404
        </p>
        <h1 className="text-slate-300 text-sm font-semibold">
          Page not found
        </h1>
        <p className="text-slate-600 text-xs leading-relaxed">
          The route you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 px-5 py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-medium rounded-lg transition-colors"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
