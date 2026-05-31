import { NextResponse } from "next/server";
import { fetchHistorical, computeReturn, computeYTD, sleep } from "@/lib/yahoo";
import { fetchCreditYields } from "@/lib/valuation";
import { fetchFredCsv } from "@/lib/fred";

// ── Ticker registries ────────────────────────────────────────────────────────

// Treasury yield indices. Yahoo reports the level as a % (e.g. 4.45 = 4.45%).
// 3Y history per spec — inversion cycle context requires the full tightening episode.
const TREASURIES = [
  { ticker: "^IRX", label: "3-Month T-Bill", tenor: "3M" },
  { ticker: "^FVX", label: "5-Year Treasury", tenor: "5Y" },
  { ticker: "^TNX", label: "10-Year Treasury", tenor: "10Y" },
  { ticker: "^TYX", label: "30-Year Treasury", tenor: "30Y" },
];

// Credit ETFs — 3Y weekly per spec (spread context requires the cycle).
const CREDIT_ETFS = [
  { ticker: "LQD",  label: "US Investment Grade (LQD)" },
  { ticker: "HYG",  label: "US High Yield (HYG)" },
  { ticker: "EMB",  label: "USD EM Sovereign (EMB)" },
  { ticker: "EMLC", label: "EM Local Currency (EMLC)" },
];

// ── History constants ─────────────────────────────────────────────────────────

const TREASURY_DAYS = 365 * 3 + 60;   // 3Y daily
const CREDIT_DAYS   = 365 * 3 + 60;   // 3Y daily (stored; route returns weekly for charts)

// ── Shared return helper ──────────────────────────────────────────────────────

type ReturnPeriods = {
  "1D": number | null;
  "1W": number | null;
  "1M": number | null;
  "3M": number | null;
  "1Y": number | null;
  "YTD": number | null;
};

function computePeriods(dates: string[], closes: number[]): ReturnPeriods {
  if (closes.length < 2) {
    return { "1D": null, "1W": null, "1M": null, "3M": null, "1Y": null, "YTD": null };
  }
  const last = closes.at(-1)!;
  const prev = closes.at(-2)!;
  return {
    "1D":  prev  ? ((last - prev) / prev) * 100 : null,
    "1W":  computeReturn(closes, 7),
    "1M":  computeReturn(closes, 30),
    "3M":  computeReturn(closes, 90),
    "1Y":  computeReturn(closes, 365),
    "YTD": computeYTD(dates, closes),
  };
}

// ── Treasury entry type ───────────────────────────────────────────────────────

type TreasuryEntry = {
  ticker: string;
  label: string;
  tenor: string;
  yieldLevel: number | null;       // current yield in % (e.g. 4.45)
  returns: ReturnPeriods;          // yield changes in pp (same % math, interpreted as pp moves)
  history: { date: string; yield: number }[];   // full 3Y series for curve charts
  dataStatus: "ok" | "error";
  error?: string;
};

// ── Credit ETF entry type ─────────────────────────────────────────────────────

type CreditEntry = {
  ticker: string;
  label: string;
  price: number | null;
  returns: ReturnPeriods;
  // Distribution yield in % from Yahoo Finance quoteSummary (Step 10).
  // e.g. 5.82 means 5.82%. null when unavailable.
  impliedYield: number | null;
  history: { date: string; price: number }[];   // weekly series for spread charts
  dataStatus: "ok" | "error";
  error?: string;
};

// ── Derived spreads ───────────────────────────────────────────────────────────

type SpreadSnapshot = {
  value: number | null;
  label: string;
  description: string;
};

function computeSpread(a: number | null, b: number | null): number | null {
  return a != null && b != null ? a - b : null;
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET() {
  // ── Fetch Treasuries ──────────────────────────────────────────────────────
  const treasuryData: TreasuryEntry[] = [];
  for (const { ticker, label, tenor } of TREASURIES) {
    const hist = await fetchHistorical(ticker, TREASURY_DAYS);
    if (hist.error || hist.closes.length === 0) {
      treasuryData.push({
        ticker, label, tenor,
        yieldLevel: null, returns: { "1D": null, "1W": null, "1M": null, "3M": null, "1Y": null, "YTD": null },
        history: [], dataStatus: "error", error: hist.error ?? "No data",
      });
    } else {
      treasuryData.push({
        ticker, label, tenor,
        yieldLevel: hist.closes.at(-1) ?? null,
        returns: computePeriods(hist.dates, hist.closes),
        history: hist.dates.map((d, i) => ({ date: d, yield: hist.closes[i] })),
        dataStatus: "ok",
      });
    }
    await sleep(200);
  }

  // ── Fetch credit implied yields (quoteSummary) ───────────────────────────
  const creditYields = await fetchCreditYields();

  // ── Fetch Credit ETFs ─────────────────────────────────────────────────────
  const creditData: CreditEntry[] = [];
  for (const { ticker, label } of CREDIT_ETFS) {
    const hist = await fetchHistorical(ticker, CREDIT_DAYS);
    if (hist.error || hist.closes.length === 0) {
      creditData.push({
        ticker, label,
        price: null, returns: { "1D": null, "1W": null, "1M": null, "3M": null, "1Y": null, "YTD": null },
        impliedYield: null, history: [], dataStatus: "error", error: hist.error ?? "No data",
      });
    } else {
      // Thin the daily series to weekly for chart storage efficiency
      const weeklyHistory = hist.dates
        .map((d, i) => ({ date: d, price: hist.closes[i] }))
        .filter((_, i) => i % 5 === 0 || i === hist.closes.length - 1);
      const rawYield = creditYields[ticker as keyof typeof creditYields] ?? null;
      creditData.push({
        ticker, label,
        price: hist.closes.at(-1) ?? null,
        returns: computePeriods(hist.dates, hist.closes),
        impliedYield: rawYield != null ? rawYield * 100 : null, // stored as % (e.g. 5.82)
        history: weeklyHistory,
        dataStatus: "ok",
      });
    }
    await sleep(200);
  }

  // ── Yahoo-sourced yields ──────────────────────────────────────────────────
  const irx = treasuryData.find((t) => t.ticker === "^IRX")?.yieldLevel ?? null;
  const tnx = treasuryData.find((t) => t.ticker === "^TNX")?.yieldLevel ?? null;
  const tyx = treasuryData.find((t) => t.ticker === "^TYX")?.yieldLevel ?? null;
  const fvx = treasuryData.find((t) => t.ticker === "^FVX")?.yieldLevel ?? null;

  // ── FRED yield curve completion ───────────────────────────────────────────
  // Yahoo Finance only has 4 treasury tickers; FRED fills the missing tenors.
  // DGS2 is most critical — enables the true 2Y10Y spread.
  // All FRED calls run in parallel; failures fall back to null (non-blocking).
  const THREE_YEARS_AGO = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return d.toISOString().split("T")[0];
  })();

  const FRED_TENORS = [
    { seriesId: "DGS6MO", tenor: "6M",  withHistory: false },
    { seriesId: "DGS1",   tenor: "1Y",  withHistory: false },
    { seriesId: "DGS2",   tenor: "2Y",  withHistory: true  }, // full 3Y history for charts
    { seriesId: "DGS7",   tenor: "7Y",  withHistory: false },
    { seriesId: "DGS20",  tenor: "20Y", withHistory: false },
  ] as const;

  type FredTenorKey = typeof FRED_TENORS[number]["tenor"];

  const fredSettled = await Promise.allSettled(
    FRED_TENORS.map(async ({ seriesId, tenor, withHistory }) => {
      const obs = await fetchFredCsv(seriesId);
      const latest = obs.at(-1);
      const history = withHistory
        ? obs
            .filter((o) => o.date >= THREE_YEARS_AGO)
            .map((o) => ({ date: o.date, yield: o.value }))
        : [];
      return { tenor, yield: latest?.value ?? null, history };
    })
  );

  const fredData: Record<FredTenorKey, { yield: number | null; history: { date: string; yield: number }[] }> =
    {} as Record<FredTenorKey, { yield: number | null; history: { date: string; yield: number }[] }>;

  fredSettled.forEach((result, i) => {
    const { tenor } = FRED_TENORS[i];
    if (result.status === "fulfilled") {
      fredData[tenor] = { yield: result.value.yield, history: result.value.history };
    } else {
      fredData[tenor] = { yield: null, history: [] };
      console.log(`  ⚠️ FRED ${tenor} (${FRED_TENORS[i].seriesId}): ${String(result.reason).slice(0, 60)}`);
    }
  });

  const dgs2 = fredData["2Y"]?.yield ?? null;

  // ── Complete 9-point yield curve (ordered by maturity) ────────────────────
  const TENOR_ORDER = ["3M", "6M", "1Y", "2Y", "5Y", "7Y", "10Y", "20Y", "30Y"] as const;
  const yieldByTenor: Record<string, number | null> = {
    "3M": irx, "5Y": fvx, "10Y": tnx, "30Y": tyx,
    "6M":  fredData["6M"]?.yield  ?? null,
    "1Y":  fredData["1Y"]?.yield  ?? null,
    "2Y":  dgs2,
    "7Y":  fredData["7Y"]?.yield  ?? null,
    "20Y": fredData["20Y"]?.yield ?? null,
  };

  const yieldCurve = TENOR_ORDER.map((tenor) => ({
    tenor,
    yield: yieldByTenor[tenor] ?? null,
  }));

  // ── Derived spreads ───────────────────────────────────────────────────────
  const spreads: SpreadSnapshot[] = [
    // 2Y10Y — the primary recession signal; use true 2Y if available
    dgs2 != null
      ? {
          value: computeSpread(tnx, dgs2),
          label: "2Y10Y Spread",
          description: "10Y minus 2Y Treasury yield. The primary yield-curve recession signal. Source: FRED DGS2.",
        }
      : {
          value: computeSpread(tnx, irx),
          label: "2Y10Y Spread (proxy: 3M10Y)",
          description: "10Y minus 3M T-Bill. Using 3M proxy — FRED 2Y temporarily unavailable.",
        },
    {
      value: computeSpread(tyx, fvx),
      label: "5Y30Y Spread",
      description: "30Y minus 5Y yield. Long-end steepness signal.",
    },
    {
      value: computeSpread(tyx, tnx),
      label: "10Y30Y Spread",
      description: "30Y minus 10Y yield. Long-end steepness.",
    },
  ];

  // ── HY-IG credit spread proxy ─────────────────────────────────────────────
  const hyg = creditData.find((c) => c.ticker === "HYG");
  const lqd = creditData.find((c) => c.ticker === "LQD");
  const hygLqdReturnDiff1M =
    hyg?.returns["1M"] != null && lqd?.returns["1M"] != null
      ? hyg.returns["1M"] - lqd.returns["1M"]
      : null;

  // ── Server log ────────────────────────────────────────────────────────────
  console.log("\n══ MarketLens /api/fixed-income ══════════════════════════");
  console.log("  Yahoo treasury yields:");
  treasuryData.forEach((t) => {
    const flag = t.dataStatus === "ok" ? "✅" : "❌";
    console.log(`    ${flag} ${t.ticker.padEnd(6)} ${t.yieldLevel?.toFixed(3) ?? "null"}%  ${t.label}`);
  });
  console.log("  FRED curve completions:");
  FRED_TENORS.forEach(({ tenor, seriesId }) => {
    const d = fredData[tenor];
    const flag = d?.yield != null ? "✅" : "⚠️";
    console.log(`    ${flag} ${tenor.padEnd(4)} ${d?.yield?.toFixed(3) ?? "null"}%  ${seriesId}  hist=${d?.history.length ?? 0}`);
  });
  console.log(`  Yield curve: ${yieldCurve.map((p) => `${p.tenor}=${p.yield?.toFixed(2) ?? "—"}`).join(" | ")}`);
  console.log("  Credit ETFs:");
  creditData.forEach((c) => {
    const flag = c.dataStatus === "ok" ? "✅" : "❌";
    console.log(`    ${flag} ${c.ticker.padEnd(5)} $${c.price?.toFixed(2) ?? "null"}  hist=${c.history.length}w  ${c.label}`);
  });
  console.log("  Spreads:");
  spreads.forEach((s) => {
    const val = s.value != null ? (s.value > 0 ? "+" : "") + s.value.toFixed(3) + "pp" : "null";
    console.log(`    ${s.label}: ${val}`);
  });
  console.log("══════════════════════════════════════════════════════════\n");

  return NextResponse.json({
    asOf: new Date().toISOString(),
    treasuries: treasuryData,
    creditEtfs: creditData,
    yieldCurve,
    spreads,
    // fredData carries DGS2 history for the cron to extract into the blob
    fredTenors: fredData,
    _meta: {
      hygLqdReturnDiff1M,
      yieldCurvePoints: yieldCurve.filter((p) => p.yield != null).length,
      dgs2Source: dgs2 != null ? "FRED DGS2" : "unavailable",
    },
  });
}
