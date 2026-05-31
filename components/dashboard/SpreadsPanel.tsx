import { changeColor } from "@/lib/formatters";
import type { SpreadEntry, FixedIncomeSnapshot } from "@/lib/types";

function SpreadValue({ value, label }: { value: number | null; label: string }) {
  if (value == null) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-slate-800/60 last:border-0 px-5">
        <span className="text-slate-400 text-xs">{label}</span>
        <span className="text-slate-600 text-xs tabular-nums">—</span>
      </div>
    );
  }

  // Inversion detection: for curve spreads, negative = inverted = warning
  const isInverted = value < 0;
  const color = isInverted ? "text-rose-400" : value > 0.5 ? "text-emerald-400" : "text-amber-400";
  const sign = value >= 0 ? "+" : "";

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800/60 last:border-0 px-5">
      <div>
        <span className="text-slate-200 text-xs">{label}</span>
        {isInverted && (
          <span className="ml-2 text-[9px] text-rose-500 bg-rose-500/10 rounded px-1 py-0.5 uppercase tracking-wide">
            inverted
          </span>
        )}
      </div>
      <span className={`${color} text-xs tabular-nums font-medium`}>
        {sign}{value.toFixed(3)}pp
      </span>
    </div>
  );
}

interface SpreadsPanelProps {
  spreads: SpreadEntry[];
  curve: FixedIncomeSnapshot["yieldCurve"];
}

export function SpreadsPanel({ spreads, curve }: SpreadsPanelProps) {
  const hasData = spreads.length > 0 || curve.length > 0;

  if (!hasData) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center px-5">
        Awaiting data refresh
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-800">
      {/* Yield curve snapshot */}
      <div>
        <div className="px-5 pt-4 pb-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">
            Yield Curve Snapshot
          </p>
        </div>
        <div className="flex items-end gap-4 px-5 pb-4 flex-wrap">
          {curve.map((pt) => (
            <div key={pt.tenor} className="text-center">
              <div className="text-sky-400 text-sm font-medium tabular-nums">
                {pt.yield != null ? `${pt.yield.toFixed(2)}%` : "—"}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{pt.tenor}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Spreads */}
      <div>
        <div className="px-5 pt-4 pb-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">
            Key Spreads
          </p>
        </div>
        {spreads.map((s) => (
          <SpreadValue key={s.label} value={s.value} label={s.label} />
        ))}
      </div>
    </div>
  );
}
