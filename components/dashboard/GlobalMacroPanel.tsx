import { fmtNum, fmtShortDate, changeColor } from "@/lib/formatters";
import type { GlobalSnapshot, MacroSeries } from "@/lib/types";

const STATUS_DOT: Record<string, string> = {
  ok:          "bg-emerald-500",
  error:       "bg-rose-500",
  unavailable: "bg-slate-600",
  limited:     "bg-amber-500",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status] ?? "bg-slate-600"}`}
      title={status}
    />
  );
}

function MacroRow({
  label,
  value,
  date,
  status,
  unit,
  frequency,
}: {
  label: string;
  value: number | null;
  date?: string | null;
  status: string;
  unit?: string;
  frequency?: string;
}) {
  const displayValue =
    value != null
      ? unit === "B"
        ? `$${fmtNum(value, 0)}B`
        : unit === "×"
        ? `${value.toFixed(1)}×`
        : `${value.toFixed(2)}%`
      : "—";

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-1.5">
        <StatusDot status={status} />
        <div>
          <span className="text-slate-300 text-xs">{label}</span>
          {(date || frequency) && (
            <div className="text-[10px] text-slate-600 mt-0.5">
              {[frequency, date ? fmtShortDate(date) : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      </div>
      <span className="text-slate-100 text-sm font-medium tabular-nums">
        {displayValue}
      </span>
    </div>
  );
}

export function GlobalMacroPanel({ data }: { data: GlobalSnapshot | null }) {
  if (!data) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center px-5">
        Awaiting data refresh
      </p>
    );
  }

  const { usMacro, dxy, eurArea } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-800">
      {/* US Macro */}
      <div className="p-5">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-3">
          United States
        </p>
        <MacroRow
          label="CPI YoY"
          value={usMacro.cpi.value}
          date={usMacro.cpi.date}
          status={usMacro.cpi.status}
          frequency="monthly"
        />
        <MacroRow
          label="Core PCE YoY"
          value={usMacro.corePce.value}
          date={usMacro.corePce.date}
          status={usMacro.corePce.status}
          frequency="monthly"
        />
        <MacroRow
          label="GDP"
          value={usMacro.gdp.value}
          date={usMacro.gdp.date}
          status={usMacro.gdp.status}
          unit="B"
          frequency="quarterly"
        />
        <MacroRow
          label="Unemployment"
          value={usMacro.unemployment.value}
          date={usMacro.unemployment.date}
          status={usMacro.unemployment.status}
          frequency="monthly"
        />
        <MacroRow
          label="Fed Funds Rate"
          value={usMacro.fedFundsRate.value}
          date={usMacro.fedFundsRate.date}
          status={usMacro.fedFundsRate.status}
          frequency="monthly"
        />
        <MacroRow
          label="10Y Breakeven"
          value={usMacro.breakeven10y.value}
          date={usMacro.breakeven10y.date}
          status={usMacro.breakeven10y.status}
          frequency="daily"
        />
        <MacroRow
          label="Real 10Y Yield"
          value={usMacro.realYield10y.value}
          date={usMacro.realYield10y.date}
          status={usMacro.realYield10y.status}
          frequency="daily"
        />
        <MacroRow
          label="Shiller CAPE"
          value={usMacro.shillerCape.value}
          date={usMacro.shillerCape.date}
          status={usMacro.shillerCape.status}
          unit="×"
          frequency="monthly"
        />
      </div>

      {/* Euro Area */}
      <div className="p-5">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-3">
          Euro Area
        </p>
        <MacroRow
          label="HICP YoY"
          value={eurArea.hicp.value}
          date={eurArea.hicp.date}
          status={eurArea.hicp.status}
          frequency="monthly"
        />
        <MacroRow
          label="GDP YoY"
          value={eurArea.gdp.value}
          date={eurArea.gdp.date}
          status={eurArea.gdp.status}
          frequency="quarterly"
        />
        <MacroRow
          label="ECB Deposit Rate"
          value={eurArea.depositRate.value}
          date={eurArea.depositRate.date}
          status={eurArea.depositRate.status}
        />
        <MacroRow
          label="ECB Main Refi Rate"
          value={eurArea.mainRefiRate.value}
          date={eurArea.mainRefiRate.date}
          status={eurArea.mainRefiRate.status}
        />

        {/* DXY */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-3">
            US Dollar Index
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <StatusDot status={dxy.status} />
              <span className="text-slate-300 text-xs">DXY</span>
            </div>
            <div className="text-right">
              <div className="text-slate-100 text-sm font-medium tabular-nums">
                {dxy.value != null ? fmtNum(dxy.value, 2) : "—"}
              </div>
              {dxy.change1d != null && (
                <div className={`text-[10px] tabular-nums ${changeColor(dxy.change1d)}`}>
                  {dxy.change1d >= 0 ? "+" : ""}{dxy.change1d.toFixed(2)}% 1D
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* OECD CLI */}
      <div className="p-5">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-3">
          OECD Composite Leading Indicators
        </p>
        {data.oecd?.cli && data.oecd.cli.length > 0 ? (
          <div className="space-y-0">
            {data.oecd.cli.map((c) => (
              <div
                key={c.country}
                className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0"
              >
                <div className="flex items-center gap-1.5">
                  <StatusDot status={c.status} />
                  <span className="text-slate-300 text-xs">{c.label}</span>
                </div>
                <span className="text-slate-100 text-xs tabular-nums">
                  {c.value != null ? c.value.toFixed(2) : "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600 text-xs">
            CLI data via FRED/OECD — may lag 1–2 months
          </p>
        )}
        {data.meta?.fredKeyPresent === false && (
          <p className="mt-3 text-[10px] text-amber-600 bg-amber-900/20 rounded px-2 py-1.5">
            FRED API key not configured — macro data may be incomplete
          </p>
        )}
      </div>
    </div>
  );
}
