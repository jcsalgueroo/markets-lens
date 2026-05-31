import { ChangeChip } from "@/components/ui/ChangeChip";
import { fmtNum } from "@/lib/formatters";
import type { CommodityEntry, CommoditiesSnapshot } from "@/lib/types";

const TH = "text-[10px] font-medium text-slate-500 uppercase tracking-wider text-right pb-2 px-2";
const THL = "text-[10px] font-medium text-slate-500 uppercase tracking-wider text-left pb-2 pl-5 pr-2";
const TD = "text-xs tabular-nums text-slate-300 text-right py-2 px-2";
const TDL = "text-xs py-2 pl-5 pr-2";

const GROUP_LABELS: Record<string, string> = {
  energy: "Energy",
  metals: "Metals",
  agriculture: "Agriculture",
};

function GroupHeader({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={8}
        className="pl-5 py-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider bg-slate-950/50 border-b border-slate-800"
      >
        {label}
      </td>
    </tr>
  );
}

function CommodityRow({
  row,
  idx,
}: {
  row: CommodityEntry;
  idx: number;
}) {
  const usdPrice =
    row.priceUsd != null ? `$${fmtNum(row.priceUsd, 2)}` : "—";

  return (
    <tr
      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
        idx % 2 === 0 ? "" : "bg-slate-900/40"
      }`}
    >
      <td className={TDL}>
        <span className={row.dataStatus === "error" ? "text-slate-500" : "text-slate-100"}>
          {row.label}
        </span>
        <div className="text-[10px] text-slate-600 mt-0.5">
          {row.ticker} · {row.unit}
        </div>
      </td>
      <td className={`${TD} text-amber-400 font-medium`}>{usdPrice}</td>
      <td className={TD}><ChangeChip value={row.returns["1D"]} /></td>
      <td className={TD}><ChangeChip value={row.returns["1W"]} /></td>
      <td className={TD}><ChangeChip value={row.returns["1M"]} /></td>
      <td className={TD}><ChangeChip value={row.returns["3M"]} /></td>
      <td className={TD}><ChangeChip value={row.returns["YTD"]} /></td>
      <td className={`${TD} pr-5`}><ChangeChip value={row.returns["1Y"]} /></td>
    </tr>
  );
}

interface CommoditiesTableProps {
  energy: CommodityEntry[];
  metals: CommodityEntry[];
  agriculture: CommodityEntry[];
  derived: CommoditiesSnapshot["derived"] | null;
}

export function CommoditiesTable({
  energy,
  metals,
  agriculture,
  derived,
}: CommoditiesTableProps) {
  const hasData = energy.length > 0 || metals.length > 0 || agriculture.length > 0;

  if (!hasData) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center">
        Awaiting data refresh
      </p>
    );
  }

  const groups: [string, CommodityEntry[]][] = [
    ["energy", energy],
    ["metals", metals],
    ["agriculture", agriculture],
  ];

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px]">
          <thead>
            <tr className="border-b border-slate-800">
              <th className={THL}>Commodity</th>
              <th className={TH}>USD Price</th>
              <th className={TH}>1D</th>
              <th className={TH}>1W</th>
              <th className={TH}>1M</th>
              <th className={TH}>3M</th>
              <th className={TH}>YTD</th>
              <th className={`${TH} pr-5`}>1Y</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, rows]) => (
              <>
                <GroupHeader key={`${group}-hdr`} label={GROUP_LABELS[group] ?? group} />
                {rows.map((row, idx) => (
                  <CommodityRow key={row.ticker} row={row} idx={idx} />
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Derived metrics strip */}
      {derived && (
        <div className="flex gap-6 flex-wrap border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
          {derived.goldCopperRatio != null && (
            <span>
              Gold/Copper Ratio:{" "}
              <strong className="text-slate-200 tabular-nums">
                {derived.goldCopperRatio.toFixed(0)}×
              </strong>
            </span>
          )}
          {derived.brentUsd != null && (
            <span>
              Brent USD:{" "}
              <strong className="text-amber-400 tabular-nums">
                ${fmtNum(derived.brentUsd, 2)}
              </strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
