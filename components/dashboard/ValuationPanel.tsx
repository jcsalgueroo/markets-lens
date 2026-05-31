import { ValBadge } from "@/components/ui/ValBadge";
import { fmtNum } from "@/lib/formatters";
import type { ValuationSnapshot } from "@/lib/types";

const PE_THRESHOLDS: Record<string, { cheap: number; rich: number; label: string }> = {
  "us-large": { cheap: 18, rich: 27, label: "<18 cheap · 18–27 fair · >27 rich" },
  "us-tech":  { cheap: 25, rich: 38, label: "<25 cheap · 25–38 fair · >38 rich" },
  "us-small": { cheap: 14, rich: 22, label: "<14 cheap · 14–22 fair · >22 rich" },
  "intl-dm":  { cheap: 13, rich: 20, label: "<13 cheap · 13–20 fair · >20 rich" },
  "em":       { cheap: 12, rich: 18, label: "<12 cheap · 12–18 fair · >18 rich" },
};

export function ValuationPanel({ data }: { data: ValuationSnapshot | null }) {
  if (!data) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center px-5">
        Awaiting data refresh — valuation will populate after the next scheduled cron run.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-800">
      {/* Equity Valuation */}
      <div className="p-5">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-3">
          Equity P/E Valuation
        </p>
        <div className="space-y-3">
          {data.equityValuations.map((e) => {
            const threshold = PE_THRESHOLDS[e.assetClass];
            return (
              <div key={e.ticker} className="flex items-center justify-between">
                <div>
                  <span className="text-slate-200 text-xs">{e.label}</span>
                  {threshold && (
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {threshold.label}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-slate-400 text-xs tabular-nums">
                    {e.trailingPE != null ? `PE ${e.trailingPE.toFixed(1)}×` : "PE —"}
                  </span>
                  <ValBadge badge={e.badge} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Credit Yields */}
      <div className="p-5">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-3">
          Credit ETF Implied Yields
        </p>
        <div className="space-y-3">
          {(
            Object.entries(data.creditYields) as [
              keyof typeof data.creditYields,
              { yield: number | null; label: string }
            ][]
          ).map(([ticker, entry]) => (
            <div key={ticker} className="flex items-center justify-between">
              <div>
                <span className="text-slate-200 text-xs">{entry.label}</span>
                <div className="text-[10px] text-slate-600 mt-0.5">{ticker}</div>
              </div>
              <span className="text-sky-400 text-sm font-medium tabular-nums">
                {entry.yield != null
                  ? `${(entry.yield * 100).toFixed(2)}%`
                  : "—"}
              </span>
            </div>
          ))}
        </div>

        {data.derived.hyIgSpreadProxy != null && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs">HY–IG Yield Spread (proxy)</span>
              <span className="text-amber-400 text-xs tabular-nums font-medium">
                +{(data.derived.hyIgSpreadProxy * 100).toFixed(2)}pp
              </span>
            </div>
            <p className="text-[10px] text-slate-600 mt-1">
              Yield differential — directional only, not OAS
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
