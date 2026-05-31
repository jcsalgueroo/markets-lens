import { ChangeChip } from "@/components/ui/ChangeChip";
import { fmtNum } from "@/lib/formatters";
import type { EquityEntry } from "@/lib/types";

const TH = "text-[10px] font-medium text-slate-500 uppercase tracking-wider text-right pb-2 px-2";
const THL = "text-[10px] font-medium text-slate-500 uppercase tracking-wider text-left pb-2 pl-5 pr-2";
const TD = "text-xs tabular-nums text-slate-300 text-right py-2 px-2";
const TDL = "text-xs py-2 pl-5 pr-2";

export function EquityTable({
  rows,
  showCurrency = false,
}: {
  rows: EquityEntry[];
  showCurrency?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center">
        Awaiting data refresh
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="border-b border-slate-800">
            <th className={THL}>Name</th>
            {showCurrency && <th className={TH}>CCY</th>}
            <th className={TH}>Price</th>
            <th className={TH}>1D</th>
            <th className={TH}>1W</th>
            <th className={TH}>1M</th>
            <th className={`${TH} pr-5`}>YTD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.ticker}
              className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                idx % 2 === 0 ? "" : "bg-slate-900/40"
              }`}
            >
              <td className={TDL}>
                <div className="flex items-center gap-1.5">
                  <span
                    className={
                      row.dataStatus === "error"
                        ? "text-slate-500"
                        : "text-slate-100"
                    }
                  >
                    {row.label}
                  </span>
                  {row.isProxy && (
                    <span className="text-[9px] text-slate-600 bg-slate-800 rounded px-1 py-0.5">
                      proxy
                    </span>
                  )}
                  {row.limitedHistory && (
                    <span className="text-[9px] text-amber-700 bg-amber-900/20 rounded px-1 py-0.5">
                      ltd
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">{row.ticker}</div>
              </td>
              {showCurrency && (
                <td className={TD}>
                  <span className="text-slate-600 text-[10px]">
                    {row.currency ?? "USD"}
                  </span>
                </td>
              )}
              <td className={TD}>
                {row.price != null ? fmtNum(row.price, row.price >= 100 ? 2 : 4) : "—"}
              </td>
              <td className={TD}>
                <ChangeChip value={row.returns["1D"]} />
              </td>
              <td className={TD}>
                <ChangeChip value={row.returns["1W"]} />
              </td>
              <td className={TD}>
                <ChangeChip value={row.returns["1M"]} />
              </td>
              <td className={`${TD} pr-5`}>
                <ChangeChip value={row.returns["YTD"]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
