"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { EquityEntry, EquityReturns } from "@/lib/types";

// Short sector names for the chart axis
const SHORT_NAMES: Record<string, string> = {
  "Information Technology": "Info Tech",
  "Consumer Discretionary": "Cons Disc",
  "Communication Services": "Comm Svcs",
  "Consumer Staples":       "Cons Stpls",
  "Health Care":            "Health Care",
  "Financials":             "Financials",
  "Industrials":            "Industrials",
  "Real Estate":            "Real Estate",
  "Utilities":              "Utilities",
  "Materials":              "Materials",
  "Energy":                 "Energy",
};

// EquityReturns only has 1D, 1W, 1M, YTD — subset of what we want to show.
type Period = keyof EquityReturns;  // "1D" | "1W" | "1M" | "YTD"
type Mode   = "abs" | "rel";

const PERIODS: Period[] = ["1W", "1M", "YTD"];

interface Props {
  rows: EquityEntry[];
  /** S&P 500 row for relative-mode benchmark */
  spRow?: EquityEntry | null;
}

export function SectorBarChart({ rows, spRow }: Props) {
  const [period, setPeriod] = useState<Period>("YTD");
  const [mode,   setMode]   = useState<Mode>("rel");

  const data = useMemo(() => {
    const spBenchmark = spRow?.returns[period] ?? null;

    const sectorBars = rows
      .filter((r) => r.returns[period] != null && r.dataStatus !== "error")
      .map((r) => {
        const raw   = r.returns[period]!;
        const value = mode === "rel" && spBenchmark != null
          ? parseFloat((raw - spBenchmark).toFixed(2))
          : parseFloat(raw.toFixed(2));
        return { name: SHORT_NAMES[r.label] ?? r.label, value, isBenchmark: false };
      })
      .sort((a, b) => b.value - a.value);

    // Always append the S&P 500 bar at the bottom for direct comparison.
    // In relative mode it shows 0 (by definition); in absolute mode its actual return.
    if (spRow?.returns[period] != null) {
      sectorBars.push({
        name: "S&P 500",
        value: mode === "rel" ? 0 : parseFloat(spRow.returns[period]!.toFixed(2)),
        isBenchmark: true,
      });
    }

    return sectorBars;
  }, [rows, period, mode, spRow]);

  if (data.length === 0) {
    return (
      <div className="h-[340px] flex items-center justify-center p-4">
        <p className="text-slate-600 text-xs text-center">Awaiting data refresh</p>
      </div>
    );
  }

  const modeLabel = mode === "rel" ? "vs S&P 500" : "Absolute";

  return (
    <div className="p-4">
      {/* Controls */}
      <div className="flex items-center justify-between mb-3 print:hidden">
        {/* Period toggles */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                period === p
                  ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30"
                  : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {/* Absolute / vs S&P toggle */}
        <div className="flex gap-1">
          {(["abs", "rel"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                mode === m
                  ? "bg-slate-700 text-slate-200 ring-1 ring-slate-600"
                  : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {m === "abs" ? "Absolute" : "vs S&P 500"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
        Sector {period} Returns — {modeLabel}
      </p>

      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 44, bottom: 0, left: 4 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 9, fill: "#475569" }}
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={76}
            tick={(props) => {
              const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
              const isSP = payload.value === "S&P 500";
              return (
                <text
                  x={x}
                  y={y}
                  dy={3}
                  textAnchor="end"
                  fontSize={9}
                  fontWeight={isSP ? 600 : 400}
                  fill={isSP ? "#38bdf8" : "#94a3b8"}
                >
                  {payload.value}
                </text>
              );
            }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value: unknown) => {
              const v = value as number;
              return [
                `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
                `${period} (${modeLabel})`,
              ];
            }}
            cursor={{ fill: "#1e293b" }}
          />
          <ReferenceLine x={0} stroke="#334155" />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={16}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={
                  entry.isBenchmark
                    ? "#38bdf8"                                   // sky-400 for S&P 500
                    : entry.value >= 0 ? "#34d399" : "#f87171"   // emerald / rose for sectors
                }
                fillOpacity={entry.isBenchmark ? 0.6 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
