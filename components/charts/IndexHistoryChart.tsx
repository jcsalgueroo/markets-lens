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

export interface SeriesDef {
  id: string;       // ticker key in history blob, e.g. "^GSPC"
  label: string;    // display name, e.g. "S&P 500"
  color: string;    // hex color
}

const TICK_INTERVAL: Record<TimeframeLabel, number> = {
  "1M":  0,
  "3M":  1,
  "6M":  3,
  "YTD": 3,
  "1Y":  7,
  "3Y":  12,
};

interface Props {
  seriesDefs: SeriesDef[];
  defaultTimeframe?: TimeframeLabel;
}

export function IndexHistoryChart({ seriesDefs, defaultTimeframe = "1Y" }: Props) {
  const [tf, setTf] = useState<TimeframeLabel>(defaultTimeframe);
  const { data, state } = useHistoryData("equities");

  const chartData = useMemo(() => {
    if (!data) return [];
    const tfDef = TIMEFRAMES.find((t) => t.label === tf)!;

    const entries = seriesDefs
      .map(({ id }) => {
        const raw = data.series[id] ?? [];
        const filtered = filterByDays(raw, tfDef.days);
        const normalized = normalizeToBase(filtered);
        return { key: id, series: normalized };
      })
      .filter((e) => e.series.length > 0);

    return mergeSeriesWide(entries);
  }, [data, tf, seriesDefs]);

  // Loading / error / empty states
  if (state === "loading") {
    return <ChartShell tf={tf} setTf={setTf}><LoadingState /></ChartShell>;
  }
  if (state === "error" || state === "empty") {
    return (
      <ChartShell tf={tf} setTf={setTf}>
        <EmptyState
          message={
            state === "empty"
              ? "History not yet available — runs after first weekly cron (Sundays 05:00 UTC)"
              : "Failed to load history"
          }
        />
      </ChartShell>
    );
  }

  const tfDef = TIMEFRAMES.find((t) => t.label === tf)!;
  const interval = TICK_INTERVAL[tf];

  return (
    <ChartShell tf={tf} setTf={setTf}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#475569" }}
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            interval={interval}
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
              const def = seriesDefs.find((s) => s.id === key);
              return [
                `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`,
                def?.label ?? key,
              ];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
            formatter={(value) => seriesDefs.find((s) => s.id === value)?.label ?? value}
          />
          {seriesDefs.map((s) => (
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
    </ChartShell>
  );
}

// ── Shared shell with timeframe toggle ────────────────────────────────────────

function ChartShell({
  tf,
  setTf,
  children,
}: {
  tf: TimeframeLabel;
  setTf: (t: TimeframeLabel) => void;
  children: React.ReactNode;
}) {
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
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-[260px] flex items-center justify-center">
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[260px] flex items-center justify-center">
      <p className="text-slate-600 text-xs text-center max-w-[280px]">{message}</p>
    </div>
  );
}
