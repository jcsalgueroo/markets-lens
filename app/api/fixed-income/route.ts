import { NextResponse } from "next/server";
import { fetchHistorical, computeReturn, computeYTD, sleep } from "@/lib/yahoo";

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
  // Implied yield approximated from 30-day SEC yield proxy:
  // Not fetched here — requires quoteSummary (Step 10). Flagged null for now.
  impliedYield: null;
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
      creditData.push({
        ticker, label,
        price: hist.closes.at(-1) ?? null,
        returns: computePeriods(hist.dates, hist.closes),
        impliedYield: null,   // populated in Step 10 (quoteSummary valuation fetch)
        history: weeklyHistory,
        dataStatus: "ok",
      });
    }
    await sleep(200);
  }

  // ── Derived spreads ───────────────────────────────────────────────────────
  const irx = treasuryData.find((t) => t.ticker === "^IRX")?.yieldLevel ?? null;
  const tnx = treasuryData.find((t) => t.ticker === "^TNX")?.yieldLevel ?? null;
  const tyx = treasuryData.find((t) => t.ticker === "^TYX")?.yieldLevel ?? null;
  const fvx = treasuryData.find((t) => t.ticker === "^FVX")?.yieldLevel ?? null;

  const spreads: SpreadSnapshot[] = [
    {
      value: computeSpread(tnx, irx),
      label: "2Y10Y Spread (proxy: 3M10Y)",
      description:
        "10Y minus 3M T-Bill yield. Negative = inverted curve (recession signal). " +
        "Note: spec calls for 2Y tenor but ^IRX (3M) is the shortest available on Yahoo Finance; " +
        "2Y yield fetched from FRED in Step 6.",
    },
    {
      value: computeSpread(tyx, fvx),
      label: "5Y30Y Spread",
      description: "30Y minus 5Y yield. Curve steepness signal.",
    },
    {
      value: computeSpread(tyx, tnx),
      label: "10Y30Y Spread",
      description: "30Y minus 10Y yield. Long-end steepness.",
    },
  ];

  // ── HY-IG credit spread proxy ─────────────────────────────────────────────
  // True HY-IG spread requires option-adjusted spread (OAS) data from FRED or Bloomberg.
  // Here we compute a price-return differential as a directional proxy.
  // The actual OAS spread will be populated from FRED in Step 6.
  const hyg = creditData.find((c) => c.ticker === "HYG");
  const lqd = creditData.find((c) => c.ticker === "LQD");
  const hygLqdReturnDiff1M =
    hyg?.returns["1M"] != null && lqd?.returns["1M"] != null
      ? hyg.returns["1M"] - lqd.returns["1M"]
      : null;

  // ── Yield curve snapshot (for curve chart: current tenors) ────────────────
  const yieldCurve = [
    { tenor: "3M", yield: irx },
    { tenor: "5Y", yield: fvx },
    { tenor: "10Y", yield: tnx },
    { tenor: "30Y", yield: tyx },
  ];

  // ── Server log ────────────────────────────────────────────────────────────
  console.log("\n══ MarketLens /api/fixed-income ══════════════════════════");
  console.log("  Treasury yields:");
  treasuryData.forEach((t) => {
    const flag = t.dataStatus === "ok" ? "✅" : "❌";
    console.log(`    ${flag} ${t.ticker.padEnd(6)} ${t.yieldLevel?.toFixed(3) ?? "null"}%  ${t.label}`);
  });
  console.log("  Credit ETFs:");
  creditData.forEach((c) => {
    const flag = c.dataStatus === "ok" ? "✅" : "❌";
    console.log(`    ${flag} ${c.ticker.padEnd(5)} $${c.price?.toFixed(2) ?? "null"}  history=${c.history.length}w  ${c.label}`);
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
    _meta: {
      hygLqdReturnDiff1M,
      notes: [
        "Treasury yields are level readings (e.g. 4.45 = 4.45%), not prices",
        "Return fields on treasuries represent yield change in pp terms (same arithmetic)",
        "3M T-Bill (^IRX) used as short-end proxy — true 2Y yield from FRED in Step 6",
        "HY-IG price-return diff is directional only; OAS spread from FRED in Step 6",
        "Credit ETF impliedYield=null until Step 10 (quoteSummary valuation fetch)",
        "Credit history thinned to weekly (every 5th bar) for storage efficiency",
      ],
    },
  });
}
