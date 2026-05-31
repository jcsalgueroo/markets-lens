/**
 * Route-level loading UI — shown while the Dashboard server component
 * streams in (KV reads + data aggregation).  Intentionally minimal:
 * KV reads are fast (<100ms), so this is mostly a flash-of-empty
 * prevention rather than a long wait.
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950 animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-slate-800 bg-slate-950/90">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-slate-800" />
            <div className="w-24 h-3.5 rounded bg-slate-800" />
            <div className="hidden md:block w-40 h-3 rounded bg-slate-800/60" />
          </div>
          <div className="w-28 h-3 rounded bg-slate-800" />
        </div>
      </div>

      {/* Key metrics strip skeleton */}
      <div className="flex gap-2 px-4 md:px-6 py-4 border-b border-slate-800">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-32 h-10 rounded-lg bg-slate-900 border border-slate-800"
          />
        ))}
      </div>

      {/* Signals bar skeleton */}
      <div className="border-b border-slate-800 px-4 md:px-6 py-3">
        <div className="w-24 h-2.5 rounded bg-slate-800 mb-3" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[118px] h-14 rounded-lg bg-slate-900 border border-slate-800"
            />
          ))}
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="max-w-[1600px] mx-auto">
        <div className="flex gap-1 border-b border-slate-800 px-4 md:px-6">
          {["Equities", "Fixed Income", "Commodities", "Macro", "Valuation"].map(
            (label) => (
              <div
                key={label}
                className="px-4 py-3 text-xs text-transparent bg-slate-800/40 rounded-t"
              >
                {label}
              </div>
            )
          )}
        </div>

        {/* Content area skeleton */}
        <div className="px-4 md:px-6 py-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-[320px] rounded-xl bg-slate-900 border border-slate-800"
              />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-slate-900 border border-slate-800"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
