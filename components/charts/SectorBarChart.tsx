"use client";

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
import type { EquityEntry } from "@/lib/types";

interface Props {
  rows: EquityEntry[];
}

// Short sector names for the chart axis
const SHORT_NAMES: Record<string, string> = {
  "Information Technology": "Info Tech",
  "Consumer Discretionary": "Cons Disc",
  "Communication Services": "Comm Svcs",
  "Consumer Staples": "Cons Stpls",
  "Health Care": "Health Care",
  "Financials": "Financials",
  "Industrials": "Industrials",
  "Real Estate": "Real Estate",
  "Utilities": "Utilities",
  "Materials": "Materials",
  "Energy": "Energy",
};

export function SectorBarChart({ rows }: Props) {
  const data = rows
    .filter((r) => r.returns.YTD != null && r.dataStatus !== "error")
    .map((r) => ({
      name: SHORT_NAMES[r.label] ?? r.label,
      ytd: +(r.returns.YTD!.toFixed(2)),
    }))
    .sort((a, b) => b.ytd - a.ytd);

  if (data.length === 0) {
    return (
      <div className="h-[320px] flex items-center justify-center p-4">
        <p className="text-slate-600 text-xs text-center">
          Awaiting data refresh
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-3">
        Sector YTD Returns (vs S&amp;P 500)
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 4 }}
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
            tick={{ fontSize: 9, fill: "#94a3b8" }}
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
              return [`${v >= 0 ? "+" : ""}${v.toFixed(2)}%`, "YTD"];
            }}
            cursor={{ fill: "#1e293b" }}
          />
          <ReferenceLine x={0} stroke="#334155" />
          <Bar dataKey="ytd" radius={[0, 3, 3, 0]} maxBarSize={16}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.ytd >= 0 ? "#34d399" : "#f87171"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
