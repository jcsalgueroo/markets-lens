import { ChangeChip } from "@/components/ui/ChangeChip";
import { fmtNum } from "@/lib/formatters";
import type { EquityEntry } from "@/lib/types";

const TH = "text-[10px] font-medium text-slate-500 uppercase tracking-wider text-right pb-2 px-2";
const THL = "text-[10px] font-medium text-slate-500 uppercase tracking-wider text-left pb-2 pl-5 pr-2";
const TD = "text-xs tabular-nums text-slate-300 text-right py-2 px-2";
const TDL = "text-xs py-2 pl-5 pr-2";

export function SectorTable({ rows }: { rows: EquityEntry[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center">
        Awaiting data refresh
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-slate-800">
            <th className={THL}>Sector</th>
            <th className={TH}>Price</th>
            <th className={TH}>1D</th>
            <th className={`${TH} text-sky-700`}>vs S&amp;P</th>
            <th className={TH}>1M</th>
            <th className={`${TH} text-sky-700`}>vs S&amp;P</th>
            <th className={TH}>YTD</th>
            <th className={`${TH} text-sky-700 pr-5`}>vs S&amp;P</th>
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
                <span
                  className={
                    row.dataStatus === "error"
                      ? "text-slate-500"
                      : "text-slate-100"
                  }
                >
                  {row.label}
                </span>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {row.ticker}
                  {row.isProxy && (
                    <span className="ml-1 text-slate-600 bg-slate-800 rounded px-1 py-0.5">
                      proxy
                    </span>
                  )}
                </div>
              </td>
              <td className={TD}>
                {row.price != null ? fmtNum(row.price, 2) : "—"}
              </td>
              <td className={TD}>
                <ChangeChip value={row.returns["1D"]} />
              </td>
              <td className={TD}>
                <ChangeChip value={row.relativeReturns?.["1D"] ?? null} />
              </td>
              <td className={TD}>
                <ChangeChip value={row.returns["1M"]} />
              </td>
              <td className={TD}>
                <ChangeChip value={row.relativeReturns?.["1M"] ?? null} />
              </td>
              <td className={TD}>
                <ChangeChip value={row.returns["YTD"]} />
              </td>
              <td className={`${TD} pr-5`}>
                <ChangeChip value={row.relativeReturns?.["YTD"] ?? null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
