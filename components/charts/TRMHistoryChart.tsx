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
  mergeSeriesWide,
  fmtAxisDate,
  TIMEFRAMES,
  type TimeframeLabel,
} from "./useHistoryData";

// Colombia macro-history blob keys (set by extractColombiaHistory in cron)
const SERIES_DEFS = [
  { id: "USDCOP",  label: "TRM (COP/USD)", color: "#38bdf8", fmt: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }) },
  { id: "OilCOP",  label: "Oil in COP",    color: "#fbbf24", fmt: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }) },
];

const TICK_INTERVAL: Record<TimeframeLabel, number> = {
  "1M":  0,
  "3M":  1,
  "6M":  3,
  "1Y":  7,
  "3Y":  12,
};

type SeriesId = "USDCOP" | "OilCOP";

interface Props {
  series?: SeriesId[];
  defaultTimeframe?: TimeframeLabel;
  height?: number;
}

export function TRMHistoryChart({
  series = ["USDCOP"],
  defaultTimeframe = "1Y",
  height = 220,
}: Props) {
  const [tf, setTf] = useState<TimeframeLabel>(defaultTimeframe);
  const { data, state } = useHistoryData("macro-colombia");

  const activeSeries = SERIES_DEFS.filter((s) => (series as string[]).includes(s.id));

  const chartData = useMemo(() => {
    if (!data) return [];
    const tfDef = TIMEFRAMES.find((t) => t.label === tf)!;

    const entries = activeSeries
      .map(({ id }) => {
        const raw = data.series[id] ?? [];
        return { key: id, series: filterByDays(raw, tfDef.days) };
      })
      .filter((e) => e.series.length > 0);

    return mergeSeriesWide(entries);
  }, [data, tf, activeSeries]);

  // Compute a rough "current" value for the reference line label
  const lastUSDCOP = useMemo(() => {
    if (!data) return null;
    const s = data.series["USDCOP"] ?? [];
    return s.at(-1)?.value ?? null;
  }, [data]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center p-4" style={{ height }}>
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
      <div className="flex items-center justify-center p-4" style={{ height }}>
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

      <ResponsiveContainer width="100%" height={height}>
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
            tickFormatter={(v: number) =>
              v >= 1000
                ? `${(v / 1000).toFixed(1)}k`
                : v.toFixed(0)
            }
            width={42}
          />
          {/* Reference line at current TRM level */}
          {lastUSDCOP != null && series.includes("USDCOP") && (
            <ReferenceLine
              y={lastUSDCOP}
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
              const def = SERIES_DEFS.find((s) => s.id === key);
              return [
                def ? def.fmt(num) : num.toFixed(0),
                def?.label ?? key,
              ];
            }}
          />
          {activeSeries.map((s) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              stroke={s.color}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              name={s.id}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[9px] text-slate-700 px-2 pt-1">
        {series.includes("USDCOP") ? "COP/USD exchange rate" : ""}
        {series.includes("OilCOP") ? " · Oil price in Colombian Pesos" : ""}
        {" · "}weekly data
      </p>
    </div>
  );
}
