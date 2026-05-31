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
  oasData?: FixedIncomeSnapshot["oasData"];
}

export function SpreadsPanel({ spreads, curve, oasData }: SpreadsPanelProps) {
  const hasData = spreads.length > 0 || curve.length > 0;

  if (!hasData) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center px-5">
        Awaiting data refresh
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate-800">
      {/* Row 1: curve spreads */}
      <div>
        <div className="px-5 pt-4 pb-1">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">
            Treasury Curve Spreads
          </p>
        </div>
        {spreads.map((s) => (
          <SpreadValue key={s.label} value={s.value} label={s.label} />
        ))}
      </div>

      {/* Row 2: OAS credit spreads */}
      {oasData && (
        <div>
          <div className="px-5 pt-4 pb-1">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">
              Credit OAS — ICE BofA / FRED
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            {/* HY OAS */}
            <div className="flex items-center justify-between py-3 px-5">
              <div>
                <span className="text-slate-200 text-xs">{oasData.hyOas.label}</span>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {oasData.hyOas.ticker}
                  {oasData.hyOas.date && ` · ${oasData.hyOas.date}`}
                </div>
              </div>
              <span className="text-rose-400 text-sm font-medium tabular-nums">
                {oasData.hyOas.value != null
                  ? `${oasData.hyOas.value.toFixed(2)}%`
                  : "—"}
              </span>
            </div>
            {/* IG OAS */}
            <div className="flex items-center justify-between py-3 px-5">
              <div>
                <span className="text-slate-200 text-xs">{oasData.igOas.label}</span>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {oasData.igOas.ticker}
                  {oasData.igOas.date && ` · ${oasData.igOas.date}`}
                </div>
              </div>
              <span className="text-sky-400 text-sm font-medium tabular-nums">
                {oasData.igOas.value != null
                  ? `${oasData.igOas.value.toFixed(2)}%`
                  : "—"}
              </span>
            </div>
            {/* HY-IG spread */}
            <div className="flex items-center justify-between py-3 px-5">
              <div>
                <span className="text-slate-200 text-xs">HY–IG OAS Spread</span>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  True OAS differential
                </div>
              </div>
              <span
                className={`text-sm font-medium tabular-nums ${
                  oasData.hyIgSpread != null
                    ? oasData.hyIgSpread > 3.5
                      ? "text-rose-400"
                      : oasData.hyIgSpread > 2.5
                      ? "text-amber-400"
                      : "text-emerald-400"
                    : "text-slate-600"
                }`}
              >
                {oasData.hyIgSpread != null
                  ? `+${oasData.hyIgSpread.toFixed(2)}pp`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
