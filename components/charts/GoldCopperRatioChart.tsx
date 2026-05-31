"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  useHistoryData,
  filterByDays,
  fmtAxisDate,
  TIMEFRAMES,
  type TimeframeLabel,
} from "./useHistoryData";

/**
 * Gold/Copper Ratio chart.
 *
 * Computed from the absolute price series already stored in the
 * commodities blob: GC=F (Gold, $/troy oz) ÷ HG=F (Copper, $/lb).
 *
 * A rising ratio = gold outperforming copper = risk-off signal.
 * A falling ratio = copper outperforming = economic growth / risk-on.
 */

const TICK_INTERVAL: Record<TimeframeLabel, number> = {
  "1M": 0,
  "3M": 1,
  "6M": 3,
  "1Y": 7,
  "YTD": 3,
  "3Y": 12,
};

export function GoldCopperRatioChart({
  defaultTimeframe = "1Y",
}: {
  defaultTimeframe?: TimeframeLabel;
}) {
  const [tf, setTf] = useState<TimeframeLabel>(defaultTimeframe);
  const { data, state } = useHistoryData("commodities");

  const { chartData, currentRatio } = useMemo(() => {
    if (!data) return { chartData: [], currentRatio: null };
    const tfDef = TIMEFRAMES.find((t) => t.label === tf)!;

    const gold   = filterByDays(data.series["GC=F"] ?? [], tfDef.days);
    const copper = filterByDays(data.series["HG=F"] ?? [], tfDef.days);

    // Index copper prices by date for O(1) lookup
    const copperByDate = new Map(copper.map((p) => [p.date, p.value]));

    const rows = gold
      .filter((p) => {
        const cu = copperByDate.get(p.date);
        return cu != null && cu > 0;
      })
      .map((p) => ({
        date: p.date,
        ratio: p.value / copperByDate.get(p.date)!,
      }));

    return {
      chartData: rows,
      currentRatio: rows.at(-1)?.ratio ?? null,
    };
  }, [data, tf]);

  if (state === "loading") {
    return (
      <div className="h-[240px] flex items-center justify-center p-4">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (state === "error" || state === "empty") {
    return (
      <div className="flex items-center justify-center p-4 h-[240px]">
        <p className="text-slate-600 text-xs text-center">
          {state === "empty"
            ? "History not yet available — refreshes daily"
            : "Failed to load history"}
        </p>
      </div>
    );
  }

  const tfDef = TIMEFRAMES.find((t) => t.label === tf)!;

  return (
    <div className="p-4">
      <div className="flex justify-end gap-1 mb-3 print:hidden">
        {TIMEFRAMES.map((t) => (
          <button
            key={t.label}
            onClick={() => setTf(t.label)}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
              tf === t.label
                ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#475569" }}
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            interval={TICK_INTERVAL[tf]}
            tickFormatter={(v) => fmtAxisDate(v as string, tfDef.days)}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#475569" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v.toFixed(0)}
            width={48}
          />
          {/* Dashed line at the current level for visual reference */}
          {currentRatio != null && (
            <ReferenceLine
              y={currentRatio}
              stroke="#334155"
              strokeDasharray="4 3"
            />
          )}
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
            labelFormatter={(label) => {
              const d = new Date((label as string) + "T12:00:00Z");
              return d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              });
            }}
            formatter={(value: unknown) => [
              (value as number).toFixed(1),
              "Gold / Copper",
            ]}
          />
          <Line
            type="monotone"
            dataKey="ratio"
            stroke="#fbbf24"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[9px] text-slate-700 px-2 pt-1">
        Gold ($/oz) ÷ Copper ($/lb) · Rising = risk-off / recession hedge ·
        Falling = risk-on / global growth · weekly data
      </p>
    </div>
  );
}
