"use client";

import { useState, useEffect } from "react";

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface HistoryData {
  dataset: string;
  updatedAt: string;
  series: Record<string, HistoryPoint[]>;
}

export type LoadState = "idle" | "loading" | "ok" | "error" | "empty";

export function useHistoryData(dataset: string) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState("loading");
    fetch(`/api/history/${dataset}`)
      .then((r) => {
        if (r.status === 404) throw new Error("empty");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HistoryData>;
      })
      .then((d) => {
        const hasData = Object.values(d.series).some((s) => s.length > 0);
        setData(d);
        setState(hasData ? "ok" : "empty");
      })
      .catch((e: Error) => {
        if (e.message === "empty") {
          setState("empty");
        } else {
          setError(e.message);
          setState("error");
        }
      });
  }, [dataset]);

  return { data, state, error };
}

// ── Timeframe helpers ─────────────────────────────────────────────────────────

export const TIMEFRAMES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "3Y", days: 365 * 3 + 60 },
] as const;

export type TimeframeLabel = (typeof TIMEFRAMES)[number]["label"];

/** Filter a series to only the last N calendar days */
export function filterByDays(
  series: HistoryPoint[],
  days: number
): HistoryPoint[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return series.filter((p) => p.date >= cutoffStr);
}

/** Normalize a series so the first point = 0% (indexed % return) */
export function normalizeToBase(series: HistoryPoint[]): HistoryPoint[] {
  if (series.length === 0) return [];
  const base = series[0].value;
  if (base === 0) return series;
  return series.map((p) => ({ date: p.date, value: ((p.value / base) - 1) * 100 }));
}

/** Merge multiple named series into Recharts "wide" row format */
export function mergeSeriesWide(
  entries: { key: string; series: HistoryPoint[] }[]
): Record<string, string | number>[] {
  const allDates = [
    ...new Set(entries.flatMap((e) => e.series.map((p) => p.date))),
  ].sort();

  return allDates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const { key, series } of entries) {
      const pt = series.find((p) => p.date === date);
      if (pt != null) row[key] = pt.value;
    }
    return row;
  });
}

/** Format a date string for X-axis labels */
export function fmtAxisDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  if (days <= 90) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}
