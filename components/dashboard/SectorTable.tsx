"use client";

import { useState, useMemo } from "react";
import { ChangeChip } from "@/components/ui/ChangeChip";
import { SortIcon, type SortDir } from "@/components/ui/SortIcon";
import { fmtNum } from "@/lib/formatters";
import type { EquityEntry } from "@/lib/types";

type SortKey =
  | "price"
  | "1D" | "rel1D"
  | "1M" | "rel1M"
  | "YTD" | "relYTD";

const TD  = "text-xs tabular-nums text-slate-300 text-right py-2 px-2";
const TDL = "text-xs py-2 pl-5 pr-2";

function getValue(row: EquityEntry, key: SortKey): number {
  switch (key) {
    case "price":  return row.price ?? -Infinity;
    case "1D":     return row.returns["1D"] ?? -Infinity;
    case "1M":     return row.returns["1M"] ?? -Infinity;
    case "YTD":    return row.returns["YTD"] ?? -Infinity;
    case "rel1D":  return row.relativeReturns?.["1D"] ?? -Infinity;
    case "rel1M":  return row.relativeReturns?.["1M"] ?? -Infinity;
    case "relYTD": return row.relativeReturns?.["YTD"] ?? -Infinity;
  }
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}

function SortHeader({
  label, sortKey, activeKey, dir, onSort, className,
}: SortHeaderProps) {
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

export function SectorTable({ rows }: { rows: EquityEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("relYTD");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortKey("relYTD");    // reset to default: rel YTD descending
      setSortDir("desc");
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
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-[10px] font-medium text-slate-500 uppercase tracking-wider text-left pb-2 pl-5 pr-2">
              Sector
            </th>
            <SortHeader label="Price"   sortKey="price"  {...headerProps} />
            <SortHeader label="1D"      sortKey="1D"     {...headerProps} />
            <th className="text-[10px] font-medium text-sky-800 uppercase tracking-wider text-right pb-2 px-2">
              vs S&amp;P
            </th>
            <SortHeader label="1M"      sortKey="1M"     {...headerProps} />
            <th className="text-[10px] font-medium text-sky-800 uppercase tracking-wider text-right pb-2 px-2">
              vs S&amp;P
            </th>
            <SortHeader label="YTD"     sortKey="YTD"    {...headerProps} />
            <SortHeader
              label="vs S&P"
              sortKey="relYTD"
              {...headerProps}
              className="pr-5 text-sky-700"
            />
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
                <span
                  className={
                    row.dataStatus === "error" ? "text-slate-500" : "text-slate-100"
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
              <td className={TD}><ChangeChip value={row.returns["1D"]} /></td>
              <td className={TD}><ChangeChip value={row.relativeReturns?.["1D"] ?? null} /></td>
              <td className={TD}><ChangeChip value={row.returns["1M"]} /></td>
              <td className={TD}><ChangeChip value={row.relativeReturns?.["1M"] ?? null} /></td>
              <td className={TD}><ChangeChip value={row.returns["YTD"]} /></td>
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
