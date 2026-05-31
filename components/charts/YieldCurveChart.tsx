"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { FixedIncomeSnapshot } from "@/lib/types";

// ── Types (mirrored from lib/blob.ts to avoid server-side imports) ────────────

interface CurveSnapshot {
  date: string;
  curve: { tenor: string; yield: number | null }[];
}

interface CurveHistoryBlob {
  updatedAt: string;
  snapshots: CurveSnapshot[];
}

// ── Overlay config ────────────────────────────────────────────────────────────

const OVERLAYS = [
  { key: "week_ago",  label: "1W ago",  color: "#fbbf24", dash: "5 3" },  // amber
  { key: "month_ago", label: "1M ago",  color: "#a78bfa", dash: "5 3" },  // violet
  { key: "dec_31",    label: "Dec 31",  color: "#f87171", dash: "5 3" },  // rose
] as const;

type OverlayKey = typeof OVERLAYS[number]["key"];

// ── Chart row type ────────────────────────────────────────────────────────────

type ChartRow = {
  tenor:      string;
  current?:   number;
  week_ago?:  number;
  month_ago?: number;
  dec_31?:    number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type CurvePoint = FixedIncomeSnapshot["yieldCurve"][number];

function isInverted(curve: CurvePoint[]): { inverted: boolean; basis: string } {
  const twoYear    = curve.find((p) => p.tenor === "2Y")?.yield  ?? null;
  const threeMonth = curve.find((p) => p.tenor === "3M")?.yield ?? null;
  const longEnd    = curve.find((p) => p.tenor === "10Y")?.yield ?? null;
  if (twoYear != null && longEnd != null)    return { inverted: twoYear    > longEnd, basis: "2Y10Y" };
  if (threeMonth != null && longEnd != null) return { inverted: threeMonth > longEnd, basis: "3M10Y" };
  return { inverted: false, basis: "" };
}

function findClosest(
  snapshots: CurveSnapshot[],
  targetDate: string
): Record<string, number | null> {
  if (!snapshots.length) return {};
  const t = new Date(targetDate + "T12:00:00Z").getTime();
  let best = snapshots[0];
  let bestDiff = Infinity;
  for (const s of snapshots) {
    const diff = Math.abs(new Date(s.date + "T12:00:00Z").getTime() - t);
    if (diff < bestDiff) { bestDiff = diff; best = s; }
  }
  return Object.fromEntries(
    best.curve.map((p) => [p.tenor, p.yield])
  );
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().split("T")[0];
}

// ── Custom dot: yield label above each point (current curve only) ─────────────

function LabeledDot(props: unknown) {
  const { cx, cy, payload, fill } = props as {
    cx: number; cy: number;
    payload: ChartRow;
    fill: string;
  };
  if (payload?.current == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={fill} stroke="#0f172a" strokeWidth={1.5} />
      <text
        x={cx} y={cy - 10}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={9}
        fontFamily="monospace"
      >
        {payload.current.toFixed(2)}%
      </text>
    </g>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  curve: CurvePoint[];
  asOf?: string | null;
}

export function YieldCurveChart({ curve, asOf }: Props) {
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(new Set());
  const [history, setHistory] = useState<CurveHistoryBlob | null>(null);

  // Fetch curve history on mount (client-side — non-blocking)
  useEffect(() => {
    fetch("/api/curve-history")
      .then((r) => (r.ok ? (r.json() as Promise<CurveHistoryBlob>) : null))
      .then((d) => { if (d) setHistory(d); })
      .catch(() => {});
  }, []);

  const toggleOverlay = (key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Reference dates for overlays
  const now       = Date.now();
  const weekAgoDate  = isoDate(now - 7  * 86_400_000);
  const monthAgoDate = isoDate(now - 30 * 86_400_000);
  const year      = new Date().getUTCFullYear();
  const dec31Date = `${year - 1}-12-31`;

  const weekAgoYields  = useMemo(() => findClosest(history?.snapshots ?? [], weekAgoDate),  [history, weekAgoDate]);
  const monthAgoYields = useMemo(() => findClosest(history?.snapshots ?? [], monthAgoDate), [history, monthAgoDate]);
  const dec31Yields    = useMemo(() => findClosest(history?.snapshots ?? [], dec31Date),    [history, dec31Date]);

  // Merge current + historical yields into a single array keyed by tenor
  const chartData: ChartRow[] = useMemo(() => {
    return curve
      .filter((p) => p.yield != null)
      .map((p) => ({
        tenor:     p.tenor,
        current:   p.yield   ?? undefined,
        week_ago:  weekAgoYields[p.tenor]  ?? undefined,
        month_ago: monthAgoYields[p.tenor] ?? undefined,
        dec_31:    dec31Yields[p.tenor]    ?? undefined,
      }));
  }, [curve, weekAgoYields, monthAgoYields, dec31Yields]);

  // Y-axis domain — encompass all visible series
  const { yMin, yMax } = useMemo(() => {
    const allYields: number[] = [];
    for (const row of chartData) {
      if (row.current   != null) allYields.push(row.current);
      if (activeOverlays.has("week_ago")  && row.week_ago  != null) allYields.push(row.week_ago);
      if (activeOverlays.has("month_ago") && row.month_ago != null) allYields.push(row.month_ago);
      if (activeOverlays.has("dec_31")    && row.dec_31    != null) allYields.push(row.dec_31);
    }
    if (!allYields.length) return { yMin: 0, yMax: 6 };
    const raw_min = Math.min(...allYields);
    const raw_max = Math.max(...allYields);
    return {
      yMin: Math.max(0, Math.floor(raw_min * 4) / 4 - 0.25),
      yMax: Math.ceil(raw_max * 4) / 4 + 0.25,
    };
  }, [chartData, activeOverlays]);

  const hasData = curve.some((p) => p.yield != null);
  if (!hasData) {
    return (
      <div className="h-[280px] flex items-center justify-center p-4">
        <p className="text-slate-600 text-xs text-center">Awaiting data refresh</p>
      </div>
    );
  }

  const { inverted, basis } = isInverted(curve);
  const areaColor  = inverted ? "#f87171" : "#38bdf8";
  const gradientId = inverted ? "curveInverted" : "curveNormal";
  const hasHistory = (history?.snapshots?.length ?? 0) > 0;

  // Overlay legend dates (resolved from closest snapshot)
  function snapshotDate(yields: Record<string, number | null>): string | null {
    const arr = history?.snapshots ?? [];
    if (!arr.length) return null;
    const firstTenor = Object.keys(yields)[0];
    if (!firstTenor) return null;
    const snap = arr.find((s) =>
      s.curve.some((p) => p.tenor === firstTenor && p.yield === yields[firstTenor])
    );
    return snap?.date ?? null;
  }

  return (
    <div className="p-4">
      {/* Header: inversion badge + overlay toggles */}
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">
            Current Curve Shape
          </p>
          {inverted ? (
            <span className="text-[9px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5 uppercase tracking-wide font-medium">
              Inverted {basis && `(${basis})`}
            </span>
          ) : (
            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 uppercase tracking-wide font-medium">
              Normal slope {basis && `(${basis})`}
            </span>
          )}
        </div>

        {/* Overlay toggles — only shown once history is loaded */}
        {hasHistory && (
          <div className="flex items-center gap-1 print:hidden">
            <span className="text-[9px] text-slate-600 mr-0.5">Compare:</span>
            {OVERLAYS.map((ov) => {
              const active = activeOverlays.has(ov.key);
              return (
                <button
                  key={ov.key}
                  onClick={() => toggleOverlay(ov.key)}
                  title={`Toggle ${ov.label} overlay`}
                  className={`
                    flex items-center gap-1 px-2 py-0.5 text-[9px] rounded font-medium
                    transition-colors border
                    ${active
                      ? "border-transparent text-slate-900"
                      : "border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500"
                    }
                  `}
                  style={active ? { backgroundColor: ov.color, borderColor: ov.color } : {}}
                >
                  {ov.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart
          data={chartData}
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

          {/* Reference line at 3M to visualise inversion depth */}
          {inverted && (
            <ReferenceLine
              y={curve.find((p) => p.tenor === "3M")?.yield ?? undefined}
              stroke="#f87171"
              strokeDasharray="4 3"
              strokeOpacity={0.35}
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
            formatter={(value: unknown, name: unknown) => {
              const v   = value as number;
              const key = String(name ?? "");
              const ov  = OVERLAYS.find((o) => o.key === key);
              const label = ov?.label ?? "Current";
              return [`${v.toFixed(3)}%`, label];
            }}
            labelFormatter={(label) => `Tenor: ${label}`}
          />

          {/* ── Overlay lines (behind the current curve) ── */}
          {OVERLAYS.map((ov) =>
            activeOverlays.has(ov.key) ? (
              <Line
                key={ov.key}
                type="monotone"
                dataKey={ov.key}
                stroke={ov.color}
                strokeWidth={1.5}
                strokeDasharray={ov.dash}
                strokeOpacity={0.6}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null
          )}

          {/* ── Current curve (solid area, on top) ── */}
          <Area
            type="monotone"
            dataKey="current"
            stroke={areaColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={(props: unknown) => {
              const { cx = 0, cy = 0, payload } =
                props as { cx?: number; cy?: number; payload?: ChartRow };
              if (!payload?.current) return <g key={String(cx)} />;
              return (
                <g key={`dot-${payload.tenor}`}>
                  <circle cx={cx} cy={cy} r={4} fill={areaColor} stroke="#0f172a" strokeWidth={1.5} />
                  <text x={cx} y={cy - 10} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">
                    {payload.current.toFixed(2)}%
                  </text>
                </g>
              );
            }}
            activeDot={{ r: 5, stroke: "#0f172a", strokeWidth: 1.5, fill: areaColor }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend for active overlays */}
      {activeOverlays.size > 0 && (
        <div className="flex gap-3 px-2 pt-2 flex-wrap print:hidden">
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5" style={{ backgroundColor: areaColor }} />
            <span className="text-[9px] text-slate-500">
              Today {asOf ? `(${new Date(asOf).toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : ""}
            </span>
          </div>
          {OVERLAYS.filter((o) => activeOverlays.has(o.key)).map((o) => {
            const yields =
              o.key === "week_ago"  ? weekAgoYields
              : o.key === "month_ago" ? monthAgoYields
              : dec31Yields;
            const d = snapshotDate(yields);
            return (
              <div key={o.key} className="flex items-center gap-1">
                <svg width="16" height="6" viewBox="0 0 16 6">
                  <line x1="0" y1="3" x2="16" y2="3" stroke={o.color} strokeWidth="1.5" strokeDasharray="5 3" strokeOpacity={0.7} />
                </svg>
                <span className="text-[9px]" style={{ color: o.color, opacity: 0.8 }}>
                  {o.label}{d ? ` (${new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] text-slate-700 px-2 pt-1">
        US Treasury yields · 9 tenors (3M–30Y) · Yahoo Finance + FRED
        {asOf ? ` · as of ${new Date(asOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
      </p>
    </div>
  );
}
