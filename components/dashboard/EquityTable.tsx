"use client";

import { useState, useMemo } from "react";
import { ChangeChip } from "@/components/ui/ChangeChip";
import { SortIcon, type SortDir } from "@/components/ui/SortIcon";
import { fmtNum } from "@/lib/formatters";
import type { EquityEntry } from "@/lib/types";

type SortKey = "price" | "1D" | "1W" | "1M" | "YTD";

const TD  = "text-xs tabular-nums text-slate-300 text-right py-2 px-2";
const TDL = "text-xs py-2 pl-5 pr-2";

function getValue(row: EquityEntry, key: SortKey): number {
  if (key === "price") return row.price ?? -Infinity;
  return row.returns[key] ?? -Infinity;
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}

function SortHeader({ label, sortKey, activeKey, dir, onSort, className }: SortHeaderProps) {
  const isActive = activeKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`
        text-[10px] font-medium uppercase tracking-wider text-right pb-2 px-2
        cursor-pointer select-none transition-colors
        ${isActive ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}
        ${className ?? ""}
      `}
    >
      {label}
      <SortIcon active={isActive} dir={isActive ? dir : null} />
    </th>
  );
}

export function EquityTable({
  rows,
  showCurrency = false,
}: {
  rows: EquityEntry[];
  showCurrency?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  function handleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");        // first click → best performers first
    } else if (sortDir === "desc") {
      setSortDir("asc");         // second click → worst first
    } else {
      setSortKey(null);          // third click → restore original order
      setSortDir(null);
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    return [...rows].sort((a, b) => {
      const va = getValue(a, sortKey);
      const vb = getValue(b, sortKey);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [rows, sortKey, sortDir]);

  if (rows.length === 0) {
    return (
      <p className="text-slate-600 text-xs py-6 text-center">
        Awaiting data refresh
      </p>
    );
  }

  const headerProps = {
    activeKey: sortKey,
    dir: sortDir,
    onSort: handleSort,
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-[10px] font-medium text-slate-500 uppercase tracking-wider text-left pb-2 pl-5 pr-2">
              Name
            </th>
            {showCurrency && (
              <th className="text-[10px] font-medium text-slate-500 uppercase tracking-wider text-right pb-2 px-2">
                CCY
              </th>
            )}
            <SortHeader label="Price" sortKey="price" {...headerProps} />
            <SortHeader label="1D"    sortKey="1D"    {...headerProps} />
            <SortHeader label="1W"    sortKey="1W"    {...headerProps} />
            <SortHeader label="1M"    sortKey="1M"    {...headerProps} />
            <SortHeader label="YTD"   sortKey="YTD"   {...headerProps} className="pr-5" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
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
                      row.dataStatus === "error" ? "text-slate-500" : "text-slate-100"
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
                  <span className="text-slate-600 text-[10px]">{row.currency ?? "USD"}</span>
                </td>
              )}
              <td className={TD}>
                {row.price != null ? fmtNum(row.price, row.price >= 100 ? 2 : 4) : "—"}
              </td>
              <td className={TD}><ChangeChip value={row.returns["1D"]} /></td>
              <td className={TD}><ChangeChip value={row.returns["1W"]} /></td>
              <td className={TD}><ChangeChip value={row.returns["1M"]} /></td>
              <td className={`${TD} pr-5`}><ChangeChip value={row.returns["YTD"]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
