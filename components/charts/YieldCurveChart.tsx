"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Dot,
} from "recharts";
import type { FixedIncomeSnapshot } from "@/lib/types";

type CurvePoint = FixedIncomeSnapshot["yieldCurve"][number];

interface Props {
  curve: CurvePoint[];
  asOf?: string | null;
}

// ── Custom labeled dot ─────────────────────────────────────────────────────────

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { tenor: string; yield: number | null };
  fill?: string;
}

function LabeledDot({ cx = 0, cy = 0, payload, fill }: DotProps) {
  if (!payload || payload.yield == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={fill} stroke="#0f172a" strokeWidth={1.5} />
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={9}
        fontFamily="monospace"
      >
        {payload.yield.toFixed(2)}%
      </text>
    </g>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isInverted(curve: CurvePoint[]): boolean {
  const shortEnd = curve.find((p) => p.tenor === "3M")?.yield ?? null;
  const longEnd  = curve.find((p) => p.tenor === "10Y")?.yield ?? null;
  return shortEnd != null && longEnd != null && shortEnd > longEnd;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function YieldCurveChart({ curve, asOf }: Props) {
  const hasData = curve.some((p) => p.yield != null);

  if (!hasData) {
    return (
      <div className="h-[260px] flex items-center justify-center p-4">
        <p className="text-slate-600 text-xs text-center">
          Awaiting data refresh
        </p>
      </div>
    );
  }

  const inverted = isInverted(curve);
  const areaColor = inverted ? "#f87171" : "#38bdf8"; // red if inverted, sky if normal
  const gradientId = inverted ? "curveInverted" : "curveNormal";

  // Find the min yield for the Y-axis floor (give it a bit of padding below)
  const yields = curve.map((p) => p.yield).filter((y): y is number => y != null);
  const yMin = Math.max(0, Math.floor(Math.min(...yields) * 4) / 4 - 0.25);
  const yMax = Math.ceil(Math.max(...yields) * 4) / 4 + 0.25;

  return (
    <div className="p-4">
      {/* Header row: inversion badge */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider">
          Current Curve Shape
        </p>
        {inverted ? (
          <span className="text-[9px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5 uppercase tracking-wide font-medium">
            Inverted
          </span>
        ) : (
          <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 uppercase tracking-wide font-medium">
            Normal slope
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={curve.filter((p) => p.yield != null)}
          margin={{ top: 20, right: 16, bottom: 0, left: 4 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={areaColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={areaColor} stopOpacity={0.03} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="tenor"
            tick={{ fontSize: 9, fill: "#475569" }}
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 9, fill: "#475569" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(2)}%`}
            width={46}
          />

          {/* Reference line at the short-end to show inversion depth visually */}
          {inverted && (
            <ReferenceLine
              y={curve.find((p) => p.tenor === "3M")?.yield ?? undefined}
              stroke="#f87171"
              strokeDasharray="4 3"
              strokeOpacity={0.4}
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
            formatter={(value: unknown) => {
              const v = value as number;
              return [`${v.toFixed(3)}%`, "Yield"];
            }}
            labelFormatter={(label) => `Tenor: ${label}`}
          />

          <Area
            type="monotone"
            dataKey="yield"
            stroke={areaColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={<LabeledDot fill={areaColor} />}
            activeDot={{ r: 5, stroke: "#0f172a", strokeWidth: 1.5, fill: areaColor }}
          />
        </AreaChart>
      </ResponsiveContainer>

      <p className="text-[9px] text-slate-700 px-2 pt-1">
        US Treasury yields · 3M / 5Y / 10Y / 30Y
        {asOf ? ` · as of ${new Date(asOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
      </p>
    </div>
  );
}
