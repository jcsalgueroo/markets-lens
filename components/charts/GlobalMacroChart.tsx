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

export interface MacroSeriesDef {
  id: string;
  label: string;
  color: string;
  /** How to format values on the Y-axis and tooltip */
  format?: "pct" | "index" | "ratio";
}

export interface RefLine {
  y: number;
  label: string;
  color: string;
  dashed?: boolean;
}

const TICK_INTERVAL: Record<TimeframeLabel, number> = {
  "1M":  0,
  "3M":  1,
  "6M":  3,
  "1Y":  7,
  "YTD": 3,
  "3Y":  12,
};

function fmtValue(v: number, format: MacroSeriesDef["format"] = "pct"): string {
  if (format === "index")  return v.toFixed(2);
  if (format === "ratio")  return `${v.toFixed(1)}×`;
  return `${v.toFixed(2)}%`;
}

interface Props {
  seriesDefs: MacroSeriesDef[];
  /** Which history blob to fetch from (default: "macro-global") */
  dataset?: string;
  defaultTimeframe?: TimeframeLabel;
  height?: number;
  zeroLine?: boolean;
  referenceLines?: RefLine[];
  note?: string;
  /**
   * Recharts YAxis domain.  Defaults to ['auto','auto'] (zoomed to data range).
   * Pass [0,'auto'] to force the Y-axis to start at zero.
   */
  yAxisDomain?: [number | string, number | string];
}

export function GlobalMacroChart({
  seriesDefs,
  dataset = "macro-global",
  defaultTimeframe = "3Y",
  height = 240,
  zeroLine = false,
  referenceLines = [],
  note,
  yAxisDomain = ["auto", "auto"],
}: Props) {
  const [tf, setTf] = useState<TimeframeLabel>(defaultTimeframe);
  const { data, state } = useHistoryData(dataset);

  const chartData = useMemo(() => {
    if (!data) return [];
    const tfDef = TIMEFRAMES.find((t) => t.label === tf)!;

    const entries = seriesDefs
      .map(({ id }) => {
        const raw = data.series[id] ?? [];
        return { key: id, series: filterByDays(raw, tfDef.days) };
      })
      .filter((e) => e.series.length > 0);

    return mergeSeriesWide(entries);
  }, [data, tf, seriesDefs]);

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

  // Pick Y-axis format from first series def (all series in a chart should share scale)
  const yFormat = seriesDefs[0]?.format ?? "pct";

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
            tickFormatter={(v: number) => fmtValue(v, yFormat)}
            width={48}
            domain={yAxisDomain}
          />
          {zeroLine && <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 3" />}
          {referenceLines.map((rl) => (
            <ReferenceLine
              key={rl.y}
              y={rl.y}
              stroke={rl.color}
              strokeDasharray={rl.dashed !== false ? "4 3" : undefined}
              strokeOpacity={0.7}
              label={{
                value: rl.label,
                position: "insideTopRight",
                fontSize: 8,
                fill: rl.color,
                opacity: 0.8,
              }}
            />
          ))}
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
              return [fmtValue(num, def?.format), def?.label ?? key];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
            formatter={(value) =>
              seriesDefs.find((s) => s.id === value)?.label ?? value
            }
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
      {note && (
        <p className="text-[9px] text-slate-700 px-2 pt-1">{note}</p>
      )}
    </div>
  );
}
