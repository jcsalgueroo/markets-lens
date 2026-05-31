/**
 * One-shot yield curve history backfill.
 *
 * Fetches date-filtered data directly from the FRED JSON API (with
 * observation_start) for all 9 treasury tenors — this avoids downloading
 * 40+ years of history per series and keeps each call well within the
 * Vercel function timeout.  Assembles per-trading-day yield curves and
 * bulk-writes them into the yield-curve history blob.
 *
 * Idempotent: existing dates are never overwritten.
 * No auth required — reads public FRED data, writes to your own blob.
 */

import { type NextRequest, NextResponse } from "next/server";
import { blobBulkWriteCurveHistory } from "@/lib/blob";
import type { CurveSnapshot } from "@/lib/blob";

export const maxDuration = 60;

// All 9 tenors from FRED DGS daily series
const FRED_TENORS = [
  { seriesId: "DGS3MO", tenor: "3M"  },
  { seriesId: "DGS6MO", tenor: "6M"  },
  { seriesId: "DGS1",   tenor: "1Y"  },
  { seriesId: "DGS2",   tenor: "2Y"  },
  { seriesId: "DGS5",   tenor: "5Y"  },
  { seriesId: "DGS7",   tenor: "7Y"  },
  { seriesId: "DGS10",  tenor: "10Y" },
  { seriesId: "DGS20",  tenor: "20Y" },
  { seriesId: "DGS30",  tenor: "30Y" },
] as const;

const TENOR_ORDER = ["3M", "6M", "1Y", "2Y", "5Y", "7Y", "10Y", "20Y", "30Y"] as const;
const MIN_TENORS  = 4; // minimum tenors required for a date to be included

// ── Fetch one FRED series with a start-date filter ────────────────────────────
// Using the FRED JSON API directly with observation_start so we only download
// the requested window rather than 40+ years of all-time history.

interface FredObs { date: string; value: string }

async function fetchFredRange(
  seriesId: string,
  observationStart: string
): Promise<{ date: string; value: number }[]> {
  const key = process.env.FRED_API_KEY;

  let url: string;
  if (key) {
    url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=${encodeURIComponent(seriesId)}` +
      `&api_key=${encodeURIComponent(key)}` +
      `&file_type=json` +
      `&sort_order=asc` +
      `&observation_start=${encodeURIComponent(observationStart)}`;
  } else {
    // Public CSV with vintage date (no key) — still returns all history but
    // we'll filter client-side; CSV is small enough for this fallback.
    url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "MarketLens/1.0" } });
    if (!res.ok) throw new Error(`CSV ${seriesId}: HTTP ${res.status}`);
    const text = await res.text();
    return text
      .trim()
      .split("\n")
      .slice(1)
      .map((l) => { const [d, v] = l.split(","); return { date: d?.trim() ?? "", value: parseFloat(v ?? "") }; })
      .filter((o) => o.date >= observationStart && !isNaN(o.value));
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "MarketLens/1.0" } });
  if (!res.ok) throw new Error(`FRED API ${seriesId}: HTTP ${res.status}`);
  const json = await res.json() as { observations?: FredObs[]; error_code?: number; error_message?: string };
  if (json.error_code) throw new Error(`FRED API ${seriesId}: ${json.error_message ?? json.error_code}`);
  return (json.observations ?? [])
    .filter((o) => o.value !== "." && o.date)
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .filter((o) => !isNaN(o.value));
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const days   = Math.min(parseInt(url.searchParams.get("days") ?? "730", 10), 730);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  console.log(`\n══ backfill-curve: ${days}d window, start=${cutoffStr} ══`);

  // ── Fetch all 9 tenors in parallel (date-filtered at the API level) ─────────
  const settled = await Promise.allSettled(
    FRED_TENORS.map(async ({ seriesId, tenor }) => {
      try {
        const data = await fetchFredRange(seriesId, cutoffStr);
        console.log(`  ✅ ${tenor.padEnd(4)} ${seriesId.padEnd(8)} → ${data.length} obs`);
        return { tenor, data };
      } catch (err) {
        console.error(`  ❌ ${tenor} (${seriesId}): ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    })
  );

  const successCount = settled.filter((r) => r.status === "fulfilled").length;
  console.log(`  FRED fetches: ${successCount}/${FRED_TENORS.length} succeeded`);

  // ── Build date → { tenor → yield } map ─────────────────────────────────────
  const byDate = new Map<string, Record<string, number>>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const { date, value } of result.value.data) {
      if (!byDate.has(date)) byDate.set(date, {});
      byDate.get(date)![result.value.tenor] = value;
    }
  }

  // ── Assemble snapshots ──────────────────────────────────────────────────────
  const snapshots: CurveSnapshot[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const yields = byDate.get(date)!;
    const curve  = TENOR_ORDER.map((tenor) => ({ tenor, yield: yields[tenor] ?? null }));
    if (curve.filter((p) => p.yield != null).length >= MIN_TENORS) {
      snapshots.push({ date, curve });
    }
  }

  console.log(`  Assembled ${snapshots.length} curve snapshots`);

  // ── Bulk-write ──────────────────────────────────────────────────────────────
  const { added, total } = await blobBulkWriteCurveHistory(snapshots);
  console.log(`  Blob: added=${added}  total=${total}`);
  console.log("══ backfill-curve done ══\n");

  return NextResponse.json({
    success: true,
    fredSucceeded: successCount,
    daysBack:  days,
    cutoff:    cutoffStr,
    assembled: snapshots.length,
    added,
    total,
    dateRange: { from: snapshots[0]?.date ?? null, to: snapshots.at(-1)?.date ?? null },
  });
}
