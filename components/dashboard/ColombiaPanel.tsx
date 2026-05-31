import { ChangeChip } from "@/components/ui/ChangeChip";
import { fmtNum, fmtShortDate } from "@/lib/formatters";
import type { ColombiaSnapshot } from "@/lib/types";

const STATUS_DOT: Record<string, string> = {
  ok:          "bg-emerald-500",
  stale:       "bg-amber-500",
  unavailable: "bg-slate-600",
  error:       "bg-rose-500",
};

function StatusDot({ status }: { status: string }) {
  const color = STATUS_DOT[status] ?? "bg-slate-600";
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${color} flex-shrink-0`}
      title={status}
    />
  );
}

export function ColombiaPanel({ data }: { data: ColombiaSnapshot | null }) {
  if (!data) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center px-5">
        Awaiting data refresh
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-800">
      {/* TRM */}
      <div className="p-5 space-y-4">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider">
          Exchange Rate &amp; Local Markets
        </p>

        {/* TRM */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <StatusDot status={data.trm.status} />
            <div>
              <div className="text-slate-200 text-xs">TRM (USD/COP)</div>
              <div className="text-[10px] text-slate-600">Yahoo Finance · USDCOP=X</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-100 text-sm font-medium tabular-nums">
              {data.trm.current != null
                ? fmtNum(data.trm.current, 2)
                : "—"}
            </div>
            <div className="text-[10px] mt-0.5">
              <ChangeChip value={data.trm.returns["1D"]} />
              {" "}
              <span className="text-slate-600">1D</span>
            </div>
          </div>
        </div>

        {/* Official BanRep fixing */}
        {data.trm.officialFixing && (
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <StatusDot status={data.trm.officialStatus} />
              <div>
                <div className="text-slate-400 text-xs">BanRep Official Fixing</div>
                <div className="text-[10px] text-slate-600">
                  datos.gov.co · {fmtShortDate(data.trm.officialFixing.date)}
                </div>
              </div>
            </div>
            <div className="text-slate-300 text-xs tabular-nums">
              {fmtNum(data.trm.officialFixing.value, 2)}
            </div>
          </div>
        )}

        {/* Oil in COP */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <StatusDot status={data.oilInCop.current != null ? "ok" : "unavailable"} />
            <div>
              <div className="text-slate-200 text-xs">Oil in COP / bbl</div>
              <div className="text-[10px] text-slate-600">
                Brent × USDCOP · Brent ${data.oilInCop.brentUsd != null ? fmtNum(data.oilInCop.brentUsd, 2) : "—"}
              </div>
            </div>
          </div>
          <div className="text-amber-400 text-sm font-medium tabular-nums">
            {data.oilInCop.current != null
              ? fmtNum(data.oilInCop.current, 0)
              : "—"}
          </div>
        </div>
      </div>

      {/* Rates */}
      <div className="p-5 space-y-4">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider">
          Interest Rates
        </p>

        {/* TES 10Y */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <StatusDot status={data.tes10y.status} />
            <div>
              <div className="text-slate-200 text-xs">TES 10Y Yield</div>
              <div className="text-[10px] text-slate-600">
                FRED/OECD · Monthly
                {data.tes10y.date && ` · ${fmtShortDate(data.tes10y.date)}`}
              </div>
            </div>
          </div>
          <div className="text-sky-400 text-sm font-medium tabular-nums">
            {data.tes10y.value != null
              ? `${data.tes10y.value.toFixed(2)}%`
              : "—"}
          </div>
        </div>

        {/* IBR */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <StatusDot status={data.ibrRate.status} />
            <div>
              <div className="text-slate-200 text-xs">IBR 3M (policy proxy)</div>
              <div className="text-[10px] text-slate-600">
                FRED/OECD · Monthly
                {data.ibrRate.date && ` · ${fmtShortDate(data.ibrRate.date)}`}
              </div>
              {data.ibrRate.note && (
                <div className="text-[9px] text-slate-600 mt-0.5 max-w-[180px]">
                  {data.ibrRate.note}
                </div>
              )}
            </div>
          </div>
          <div className="text-sky-400 text-sm font-medium tabular-nums">
            {data.ibrRate.value != null
              ? `${data.ibrRate.value.toFixed(2)}%`
              : "—"}
          </div>
        </div>

        {/* TRM return periods */}
        {data.trm.current != null && (
          <div className="mt-2 pt-3 border-t border-slate-800">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
              TRM Returns
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {(["1W", "1M", "3M", "1Y"] as const).map((p) => (
                <div key={p}>
                  <div className="text-xs">
                    <ChangeChip value={data.trm.returns[p]} />
                  </div>
                  <div className="text-[10px] text-slate-600">{p}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
