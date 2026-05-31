import { NextRequest, NextResponse } from "next/server";
import { fetchHistorical, sleep } from "@/lib/yahoo";
import { blobWriteHistory, HistorySeries } from "@/lib/blob";

// ── Auth ──────────────────────────────────────────────────────────────────────

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

// ── Ticker registry ───────────────────────────────────────────────────────────
// Mirrors the equities route — update both if tickers change.

const ALL_EQUITY_TICKERS = [
  // US Broad
  { ticker: "^GSPC",      group: "usBroad" },
  { ticker: "^NDX",       group: "usBroad" },
  { ticker: "^RUT",       group: "usBroad" },
  { ticker: "^DJI",       group: "usBroad" },
  // US Sectors
  { ticker: "^SP500-45",  group: "usSectors" },
  { ticker: "^SP500-40",  group: "usSectors" },
  { ticker: "XLE",        group: "usSectors" },
  { ticker: "^SP500-35",  group: "usSectors" },
  { ticker: "^SP500-20",  group: "usSectors" },
  { ticker: "^SP500-30",  group: "usSectors" },
  { ticker: "^SP500-25",  group: "usSectors" },
  { ticker: "^SP500-60",  group: "usSectors" },
  { ticker: "^SP500-55",  group: "usSectors" },
  { ticker: "^SP500-15",  group: "usSectors" },
  { ticker: "^SP500-50",  group: "usSectors" },
  // US Factors
  { ticker: "MTUM",       group: "usFactors" },
  { ticker: "VLUE",       group: "usFactors" },
  { ticker: "QUAL",       group: "usFactors" },
  { ticker: "USMV",       group: "usFactors" },
  { ticker: "IWF",        group: "usFactors" },
  { ticker: "IWD",        group: "usFactors" },
  // Europe
  { ticker: "^STOXX50E",  group: "europe" },
  { ticker: "^STOXX",     group: "europe" },
  { ticker: "^GDAXI",     group: "europe" },
  { ticker: "^FCHI",      group: "europe" },
  { ticker: "^FTSE",      group: "europe" },
  { ticker: "^IBEX",      group: "europe" },
  { ticker: "FTSEMIB.MI", group: "europe" },
  // Asia
  { ticker: "^N225",      group: "asia" },
  { ticker: "^HSI",       group: "asia" },
  { ticker: "000300.SS",  group: "asia" },
  { ticker: "^KS11",      group: "asia" },
  { ticker: "^NSEI",      group: "asia" },
  { ticker: "^AXJO",      group: "asia" },
  { ticker: "^TWII",      group: "asia" },
  // Emerging Markets
  { ticker: "^BVSP",      group: "em" },
  { ticker: "^MXX",       group: "em" },
  { ticker: "ICOLCAP.CL", group: "em" },
  { ticker: "ECH",        group: "em" },
  { ticker: "EEM",        group: "em" },
  // DXY (useful for equity/dollar correlation charts)
  { ticker: "DX-Y.NYB",   group: "fx" },
] as const;

// ── Route ─────────────────────────────────────────────────────────────────────

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const series: HistorySeries = {};
  const results: Record<string, "ok" | "limited" | "error"> = {};

  console.log(`\n══ Weekly cron — equity history (${ALL_EQUITY_TICKERS.length} tickers) ══`);

  for (const { ticker, group } of ALL_EQUITY_TICKERS) {
    try {
      // 3 years of calendar days → ~156 weekly bars after thinning
      const hist = await fetchHistorical(ticker, 365 * 3);

      if (hist.error || hist.closes.length <= 1) {
        results[ticker] = hist.limitedHistory ? "limited" : "error";
        console.log(`  ❌ ${ticker.padEnd(14)} ${group}  ${hist.error ?? "limitedHistory"}`);
      } else {
        // Thin daily → weekly (keep every 5th bar + always keep last)
        const weekly = hist.dates
          .map((d, i) => ({ date: d, value: hist.closes[i] }))
          .filter((_, i) => i % 5 === 0 || i === hist.closes.length - 1);
        series[ticker] = weekly;
        results[ticker] = "ok";
        console.log(`  ✅ ${ticker.padEnd(14)} ${group}  ${weekly.length} weekly bars`);
      }
    } catch (e: unknown) {
      results[ticker] = "error";
      console.log(`  ❌ ${ticker.padEnd(14)} ${group}  ${e instanceof Error ? e.message.slice(0, 40) : String(e)}`);
    }

    // 150 ms gap — enough to stay under Yahoo's soft rate limit
    await sleep(150);
  }

  // ── Write to Blob ──────────────────────────────────────────────────────────
  let blobStatus = "ok";
  const seriesCount = Object.keys(series).length;

  try {
    if (seriesCount > 0) {
      await blobWriteHistory("equities", series);
      console.log(`  📦 Blob written: history/equities.json  (${seriesCount} series)`);
    } else {
      blobStatus = "skipped (no data)";
      console.log("  ⏭️  Blob skipped — no series data collected");
    }
  } catch (e: unknown) {
    blobStatus = e instanceof Error ? e.message : String(e);
    console.log(`  ❌ Blob write failed: ${blobStatus}`);
  }

  const okCount = Object.values(results).filter((v) => v === "ok").length;
  const success = okCount > 0 && blobStatus === "ok";

  console.log(`\n  Summary: ${okCount}/${ALL_EQUITY_TICKERS.length} tickers OK  |  blob: ${blobStatus}`);
  console.log("══════════════════════════════════════════════════════\n");

  return NextResponse.json(
    {
      success,
      tickersOk: okCount,
      tickersTotal: ALL_EQUITY_TICKERS.length,
      blobStatus,
      results,
      ranAt: new Date().toISOString(),
    },
    { status: success ? 200 : 207 }
  );
}
