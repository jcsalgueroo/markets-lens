import { changeColor } from "@/lib/formatters";
import type { TreasuryEntry } from "@/lib/types";

const TH = "text-[10px] font-medium text-slate-500 uppercase tracking-wider text-right pb-2 px-2";
const THL = "text-[10px] font-medium text-slate-500 uppercase tracking-wider text-left pb-2 pl-5 pr-2";
const TD = "text-xs tabular-nums text-slate-300 text-right py-2 px-2";
const TDL = "text-xs py-2 pl-5 pr-2";

/** Yield changes use percentage return math — show with sign + % */
function YieldChange({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const color = changeColor(value, 0.02);
  const sign = value >= 0 ? "+" : "";
  return (
    <span className={`${color} tabular-nums`}>
      {sign}{value.toFixed(2)}%
    </span>
  );
}

export function TreasuryTable({ rows }: { rows: TreasuryEntry[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center">
        Awaiting data refresh
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            <th className={THL}>Instrument</th>
            <th className={TH}>Tenor</th>
            <th className={TH}>Yield</th>
            <th className={TH}>1D∆</th>
            <th className={TH}>1W∆</th>
            <th className={TH}>1M∆</th>
            <th className={`${TH} pr-5`}>1Y∆</th>
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
                <span className="text-slate-100">{row.label}</span>
                <div className="text-[10px] text-slate-600 mt-0.5">{row.ticker}</div>
              </td>
              <td className={TD}>
                <span className="text-slate-500">{row.tenor}</span>
              </td>
              <td className={`${TD} text-sky-400 font-medium`}>
                {row.yieldLevel != null ? `${row.yieldLevel.toFixed(3)}%` : "—"}
              </td>
              <td className={TD}><YieldChange value={row.returns["1D"]} /></td>
              <td className={TD}><YieldChange value={row.returns["1W"]} /></td>
              <td className={TD}><YieldChange value={row.returns["1M"]} /></td>
              <td className={`${TD} pr-5`}><YieldChange value={row.returns["1Y"]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
