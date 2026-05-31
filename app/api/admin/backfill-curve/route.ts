/**
 * Yield curve history backfill — reads from the fixed-income blob.
 *
 * The daily cron already writes full FRED DGS history for all treasury
 * tenors into the fixed-income blob.  This endpoint reads that blob and
 * assembles per-trading-day yield curves, then writes them into the
 * yield-curve history blob so the chart overlays work immediately.
 *
 * No external API calls — uses data that is already on disk.
 * Idempotent: existing dates are never overwritten.
 * Safe to call multiple times.
 */

import { NextResponse } from "next/server";
import { blobReadHistory, blobBulkWriteCurveHistory } from "@/lib/blob";
import type { CurveSnapshot } from "@/lib/blob";

export const maxDuration = 30; // plenty — only reads/writes blobs

// Map fixed-income blob series keys → standard tenor labels
const SERIES_TO_TENOR: Record<string, string> = {
  "^IRX": "3M",   // Yahoo Finance / FRED DGS3MO (daily)
  "DGS2": "2Y",   // FRED DGS2 (daily)
  "^FVX": "5Y",   // Yahoo Finance / FRED DGS5 (daily)
  "^TNX": "10Y",  // Yahoo Finance / FRED DGS10 (daily)
  "^TYX": "30Y",  // Yahoo Finance / FRED DGS30 (daily)
};

const TENOR_ORDER = ["3M", "6M", "1Y", "2Y", "5Y", "7Y", "10Y", "20Y", "30Y"] as const;
const MIN_TENORS  = 3; // lower threshold since we only have 5 of 9 tenors

export async function GET() {
  // ── Read the fixed-income blob ─────────────────────────────────────────────
  const fiBlob = await blobReadHistory("fixed-income");
  if (!fiBlob) {
    return NextResponse.json(
      { error: "fixed-income blob not found — run /api/cron/daily first" },
      { status: 404 }
    );
  }

  const seriesCount = Object.keys(fiBlob.series).length;
  console.log(`\n══ backfill-curve: reading fixed-income blob (${seriesCount} series) ══`);

  // ── Build date → { tenor → yield } map ─────────────────────────────────────
  const byDate = new Map<string, Record<string, number>>();
  for (const [seriesKey, tenorLabel] of Object.entries(SERIES_TO_TENOR)) {
    const points = fiBlob.series[seriesKey] ?? [];
    console.log(`  ${tenorLabel.padEnd(4)} ← ${seriesKey.padEnd(8)} (${points.length} pts)`);
    for (const { date, value } of points) {
      if (!byDate.has(date)) byDate.set(date, {});
      byDate.get(date)![tenorLabel] = value;
    }
  }

  // ── Assemble snapshots ──────────────────────────────────────────────────────
  const snapshots: CurveSnapshot[] = [];
  const dates = [...byDate.keys()].sort();
  console.log(`  Date range: ${dates[0]} → ${dates.at(-1)} (${dates.length} unique dates)`);

  for (const date of dates) {
    const yields = byDate.get(date)!;
    const curve  = TENOR_ORDER.map((tenor) => ({
      tenor,
      yield: yields[tenor] ?? null,
    }));
    const validCount = curve.filter((p) => p.yield != null).length;
    if (validCount >= MIN_TENORS) {
      snapshots.push({ date, curve });
    }
  }

  console.log(`  Assembled ${snapshots.length} yield curve snapshots`);

  // ── Bulk-write into the yield-curve blob ────────────────────────────────────
  const { added, total } = await blobBulkWriteCurveHistory(snapshots);
  console.log(`  blob:yield-curve: added=${added}  total=${total}`);
  console.log("══ backfill-curve done ══\n");

  return NextResponse.json({
    success:   true,
    source:    "fixed-income blob",
    tenors:    Object.entries(SERIES_TO_TENOR).map(([k, v]) => `${v}=${k}`),
    assembled: snapshots.length,
    added,
    total,
    dateRange: { from: snapshots[0]?.date ?? null, to: snapshots.at(-1)?.date ?? null },
  });
}
