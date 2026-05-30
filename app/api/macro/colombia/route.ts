import { NextResponse } from "next/server";
import { fetchHistorical, computeReturn, computeYTD, sleep } from "@/lib/yahoo";
import { fetchFredCsv } from "@/lib/fred";
import { fetchTrmLatest } from "@/lib/datos-gov";

// ── Source configuration ──────────────────────────────────────────────────────

const FRED_COL_10Y = "COLIRLTLT01STM"; // Colombia 10Y bond yield (OECD, monthly)
const FRED_COL_IBR = "COLIR3TIB01STM"; // Colombia 3M interbank rate (monthly)

const TRM_DAYS   = 365 * 3 + 60;
const BRENT_DAYS = 365 * 3 + 60;

// ── Types ─────────────────────────────────────────────────────────────────────

type ReturnPeriods = {
  "1D": number | null;
  "1W": number | null;
  "1M": number | null;
  "3M": number | null;
  "1Y": number | null;
  "YTD": number | null;
};

type SourceStatus = "ok" | "stale" | "unavailable";

type RateReading = {
  value: number | null;
  date: string | null;
  source: string;
  status: SourceStatus;
  note?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function computePeriods(dates: string[], closes: number[]): ReturnPeriods {
  if (closes.length < 2) {
    return { "1D": null, "1W": null, "1M": null, "3M": null, "1Y": null, "YTD": null };
  }
  return {
    "1D":  ((closes.at(-1)! - closes.at(-2)!) / closes.at(-2)!) * 100,
    "1W":  computeReturn(closes, 7),
    "1M":  computeReturn(closes, 30),
    "3M":  computeReturn(closes, 90),
    "1Y":  computeReturn(closes, 365),
    "YTD": computeYTD(dates, closes),
  };
}

function toWeekly<T extends { date: string }>(rows: T[]): T[] {
  return rows.filter((_, i) => i % 5 === 0 || i === rows.length - 1);
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET() {
  const errors: string[] = [];

  // ── 1. TRM — Yahoo Finance (primary) ─────────────────────────────────────
  let trmHistory: { date: string; rate: number }[] = [];
  let trmCurrent: number | null = null;
  let trmReturns: ReturnPeriods = { "1D": null, "1W": null, "1M": null, "3M": null, "1Y": null, "YTD": null };
  let trmStatus: SourceStatus = "unavailable";

  try {
    const hist = await fetchHistorical("USDCOP=X", TRM_DAYS);
    if (!hist.error && hist.closes.length > 20) {
      trmCurrent = hist.closes.at(-1) ?? null;
      trmReturns = computePeriods(hist.dates, hist.closes);
      trmHistory = toWeekly(hist.dates.map((d, i) => ({ date: d, rate: hist.closes[i] })));
      trmStatus = "ok";
    } else {
      errors.push(`TRM Yahoo: ${hist.error ?? "no data"}`);
    }
  } catch (e) {
    errors.push(`TRM Yahoo: ${String(e)}`);
  }
  await sleep(200);

  // ── 2. TRM official — datos.gov.co (BanRep fixing, backup) ───────────────
  let trmOfficial: { date: string; value: number } | null = null;
  let trmOfficialStatus: SourceStatus = "unavailable";

  try {
    const latest = await fetchTrmLatest();
    if (latest) {
      trmOfficial = latest;
      trmOfficialStatus = "ok";
      if (!trmCurrent) trmCurrent = latest.value;
    }
  } catch (e) {
    errors.push(`TRM datos.gov.co: ${String(e)}`);
  }

  // ── 3. TES 10Y yield — FRED (monthly) ────────────────────────────────────
  // Only the 10Y is available from free sources. 2Y and 5Y have been dropped —
  // no free source identified (BanRep blocked by WAF, Yahoo has no COP bond tickers).
  let tes10y: RateReading = { value: null, date: null, source: "FRED/OECD", status: "unavailable" };
  let tes10yHistory: { date: string; rate: number }[] = [];

  try {
    const obs = await fetchFredCsv(FRED_COL_10Y);
    const last = obs.at(-1);
    if (last) {
      tes10y = {
        value: last.value,
        date: last.date,
        source: "FRED/OECD (COLIRLTLT01STM)",
        status: "ok",
        note: "Monthly series — vintage date shown.",
      };
      tes10yHistory = obs.map((o) => ({ date: o.date, rate: o.value }));
    }
  } catch (e) {
    errors.push(`TES 10Y: ${String(e)}`);
  }

  // ── 4. IBR / policy rate proxy — FRED (monthly) ──────────────────────────
  let ibrRate: RateReading = { value: null, date: null, source: "FRED/OECD", status: "unavailable" };
  let ibrHistory: { date: string; rate: number }[] = [];

  try {
    const obs = await fetchFredCsv(FRED_COL_IBR);
    const last = obs.at(-1);
    if (last) {
      ibrRate = {
        value: last.value,
        date: last.date,
        source: "FRED/OECD (COLIR3TIB01STM)",
        status: "ok",
        note: "3M interbank rate (monthly). Tracks BanRep policy rate with ~20-50bp spread.",
      };
      ibrHistory = obs.map((o) => ({ date: o.date, rate: o.value }));
    }
  } catch (e) {
    errors.push(`IBR: ${String(e)}`);
  }

  // ── 5. Brent & oil-in-COP ────────────────────────────────────────────────
  let brentUsd: number | null = null;
  let oilInCop: number | null = null;
  let oilInCopHistory: { date: string; value: number }[] = [];

  try {
    const brentHist = await fetchHistorical("BZ=F", BRENT_DAYS);
    await sleep(200);
    const usdcopHist = await fetchHistorical("USDCOP=X", BRENT_DAYS);

    if (!brentHist.error && !usdcopHist.error && brentHist.closes.length > 20) {
      brentUsd = brentHist.closes.at(-1) ?? null;
      const copByDate = new Map(usdcopHist.dates.map((d, i) => [d, usdcopHist.closes[i]]));
      const aligned = brentHist.dates
        .map((d, i) => {
          const cop = copByDate.get(d);
          const brent = brentHist.closes[i];
          return cop && brent ? { date: d, value: brent * cop } : null;
        })
        .filter((x): x is { date: string; value: number } => x !== null);

      oilInCop = aligned.at(-1)?.value ?? null;
      oilInCopHistory = toWeekly(aligned);
    }
  } catch (e) {
    errors.push(`Oil/COP: ${String(e)}`);
  }

  // ── Server log ────────────────────────────────────────────────────────────
  console.log("\n══ MarketLens /api/macro/colombia ═══════════════════════════");
  console.log(`  TRM:      ${trmCurrent?.toFixed(2) ?? "null"} COP/USD  [${trmStatus}]  history=${trmHistory.length}w`);
  console.log(`  TRM off:  ${trmOfficial?.value?.toFixed(2) ?? "null"}  [${trmOfficialStatus}]  ${trmOfficial?.date ?? ""}`);
  console.log(`  TES 10Y:  ${tes10y.value?.toFixed(2) ?? "null"}%  [${tes10y.status}]  ${tes10y.date ?? ""}`);
  console.log(`  IBR 3M:   ${ibrRate.value?.toFixed(2) ?? "null"}%  [${ibrRate.status}]  ${ibrRate.date ?? ""}`);
  console.log(`  Oil/COP:  ${oilInCop?.toFixed(0) ?? "null"} COP/bbl  history=${oilInCopHistory.length}w`);
  if (errors.length) console.log(`  Errors:   ${errors.join("; ")}`);
  console.log("═════════════════════════════════════════════════════════════\n");

  return NextResponse.json({
    asOf: new Date().toISOString(),
    trm: {
      current: trmCurrent,
      returns: trmReturns,
      officialFixing: trmOfficial,
      history: trmHistory,
      status: trmStatus,
      officialStatus: trmOfficialStatus,
    },
    tes10y: {
      ...tes10y,
      history: tes10yHistory,
    },
    ibrRate: {
      ...ibrRate,
      history: ibrHistory,
    },
    oilInCop: {
      current: oilInCop,
      brentUsd,
      history: oilInCopHistory,
    },
    errors: errors.length ? errors : undefined,
  });
}
