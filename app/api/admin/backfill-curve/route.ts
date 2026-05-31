/**
 * One-shot yield curve history backfill.
 *
 * Fetches up to 2 years of daily data from FRED for all 9 treasury tenors,
 * assembles a per-trading-day full yield curve, and bulk-writes them into
 * the yield-curve history blob.  Subsequent daily cron runs then append
 * incrementally, so this only needs to be called once.
 *
 * Protected by the same CRON_SECRET used for the cron routes.
 * Invoke from Vercel → Functions → GET /api/admin/backfill-curve
 * with Authorization: Bearer <CRON_SECRET> header.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchFredCsv } from "@/lib/fred";
import { blobBulkWriteCurveHistory } from "@/lib/blob";
import type { CurveSnapshot } from "@/lib/blob";

export const maxDuration = 60;

// All 9 tenors available as daily FRED DGS series
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

// Minimum number of tenors with valid data for a day to be included
const MIN_TENORS = 4;

function authorized(req: NextRequest): boolean {
  const auth   = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // How many calendar days back to fetch (default 2 years)
  const url   = new URL(req.url);
  const days  = Math.min(parseInt(url.searchParams.get("days") ?? "730", 10), 730);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  console.log(`\n══ backfill-curve: fetching ${days}d from FRED (cutoff ${cutoffStr}) ══`);

  // ── Fetch all 9 tenors in parallel ─────────────────────────────────────────
  const settled = await Promise.allSettled(
    FRED_TENORS.map(async ({ seriesId, tenor }) => {
      const obs = await fetchFredCsv(seriesId);
      const filtered = obs.filter((o) => o.date >= cutoffStr);
      console.log(`  ${tenor.padEnd(4)} ${seriesId.padEnd(8)} → ${filtered.length} obs`);
      return { tenor, data: filtered };
    })
  );

  // ── Build date → { tenor → yield } map ────────────────────────────────────
  const byDate = new Map<string, Record<string, number>>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const { date, value } of result.value.data) {
      if (!byDate.has(date)) byDate.set(date, {});
      byDate.get(date)![result.value.tenor] = value;
    }
  }

  // ── Assemble snapshots ─────────────────────────────────────────────────────
  const snapshots: CurveSnapshot[] = [];
  const dates = [...byDate.keys()].sort();

  for (const date of dates) {
    const yields = byDate.get(date)!;
    const curve  = TENOR_ORDER.map((tenor) => ({
      tenor,
      yield: yields[tenor] ?? null,
    }));
    // Skip days with too few data points (e.g. holidays with partial FRED data)
    const validCount = curve.filter((p) => p.yield != null).length;
    if (validCount >= MIN_TENORS) {
      snapshots.push({ date, curve });
    }
  }

  console.log(`  Assembled ${snapshots.length} snapshots over ${days} days`);

  // ── Bulk-write into the blob ───────────────────────────────────────────────
  const { added, total } = await blobBulkWriteCurveHistory(snapshots);

  console.log(`  Blob: added=${added}  total=${total}`);
  console.log("══ backfill-curve done ══\n");

  return NextResponse.json({
    success: true,
    daysBack: days,
    cutoff:   cutoffStr,
    assembled: snapshots.length,
    added,
    total,
    dateRange: {
      from: snapshots[0]?.date ?? null,
      to:   snapshots.at(-1)?.date ?? null,
    },
  });
}
