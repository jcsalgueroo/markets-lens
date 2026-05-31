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
  Legend,
} from "recharts";
import {
  useHistoryData,
  filterByDays,
  normalizeToBase,
  mergeSeriesWide,
  fmtAxisDate,
  TIMEFRAMES,
  type TimeframeLabel,
} from "./useHistoryData";

const COMMODITY_SERIES = [
  { id: "GC=F", label: "Gold",   color: "#fbbf24" }, // amber
  { id: "CL=F", label: "WTI",    color: "#38bdf8" }, // sky
  { id: "HG=F", label: "Copper", color: "#fb923c" }, // orange
  { id: "BZ=F", label: "Brent",  color: "#a78bfa" }, // violet
];

const TICK_INTERVAL: Record<TimeframeLabel, number> = {
  "1M":  0,
  "3M":  1,
  "6M":  3,
  "1Y":  7,
  "3Y":  12,
};

export function CommoditiesHistoryChart({
  defaultTimeframe = "1Y",
}: {
  defaultTimeframe?: TimeframeLabel;
}) {
  const [tf, setTf] = useState<TimeframeLabel>(defaultTimeframe);
  const { data, state } = useHistoryData("commodities");

  const chartData = useMemo(() => {
    if (!data) return [];
    const tfDef = TIMEFRAMES.find((t) => t.label === tf)!;

    const entries = COMMODITY_SERIES
      .map(({ id }) => {
        const raw = data.series[id] ?? [];
        const filtered = filterByDays(raw, tfDef.days);
        const normalized = normalizeToBase(filtered);
        return { key: id, series: normalized };
      })
      .filter((e) => e.series.length > 0);

    return mergeSeriesWide(entries);
  }, [data, tf]);

  if (state === "loading") {
    return (
      <div className="h-[260px] flex items-center justify-center p-4">
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
      <div className="p-4 h-[280px] flex items-center justify-center">
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

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
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
            tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
            itemStyle={{ padding: "1px 0" }}
            labelFormatter={(label) => {
              const d = new Date((label as string) + "T12:00:00Z");
              return d.toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
              });
            }}
            formatter={(value: unknown, name: unknown) => {
              const num = value as number;
              const key = String(name ?? "");
              const def = COMMODITY_SERIES.find((s) => s.id === key);
              return [
                `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`,
                def?.label ?? key,
              ];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
            formatter={(value) =>
              COMMODITY_SERIES.find((s) => s.id === value)?.label ?? value
            }
          />
          {COMMODITY_SERIES.map((s) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              stroke={s.color}
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[9px] text-slate-700 px-2 pt-1">
        Normalized to 0% at start of period · weekly data
      </p>
    </div>
  );
}
