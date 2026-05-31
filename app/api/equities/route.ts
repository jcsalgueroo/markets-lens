import { NextResponse } from "next/server";
import { fetchHistorical, computeReturn, computeYTD, sleep } from "@/lib/yahoo";

// ── Ticker registries ────────────────────────────────────────────────────────

const US_BROAD = [
  { ticker: "^GSPC", label: "S&P 500" },
  { ticker: "^NDX",  label: "Nasdaq 100" },
  { ticker: "^RUT",  label: "Russell 2000" },
  { ticker: "^DJI",  label: "Dow Jones" },
];

// ^SP500-10 (Energy) is delisted from Yahoo Finance — XLE (SPDR Energy ETF) is the proxy.
const US_SECTORS: Array<{ ticker: string; label: string; proxy?: boolean }> = [
  { ticker: "^SP500-45", label: "Information Technology" },
  { ticker: "^SP500-40", label: "Financials" },
  { ticker: "XLE",       label: "Energy",                  proxy: true },
  { ticker: "^SP500-35", label: "Health Care" },
  { ticker: "^SP500-20", label: "Industrials" },
  { ticker: "^SP500-30", label: "Consumer Staples" },
  { ticker: "^SP500-25", label: "Consumer Discretionary" },
  { ticker: "^SP500-60", label: "Real Estate" },
  { ticker: "^SP500-55", label: "Utilities" },
  { ticker: "^SP500-15", label: "Materials" },
  { ticker: "^SP500-50", label: "Communication Services" },
];

const US_FACTORS = [
  { ticker: "MTUM", label: "Momentum (MTUM)" },
  { ticker: "VLUE", label: "Value (VLUE)" },
  { ticker: "QUAL", label: "Quality (QUAL)" },
  { ticker: "USMV", label: "Min Vol (USMV)" },
  { ticker: "IWF",  label: "R1000 Growth (IWF)" },
  { ticker: "IWD",  label: "R1000 Value (IWD)" },
];

// Europe — all native indices, all in local currency
const EUROPE = [
  { ticker: "^STOXX50E",  label: "Euro Stoxx 50",      currency: "EUR" },
  { ticker: "^STOXX",     label: "STOXX Europe 600",   currency: "EUR" },
  { ticker: "^GDAXI",     label: "DAX",                currency: "EUR" },
  { ticker: "^FCHI",      label: "CAC 40",             currency: "EUR" },
  { ticker: "^FTSE",      label: "FTSE 100",           currency: "GBP" },
  { ticker: "^IBEX",      label: "IBEX 35",            currency: "EUR" },
  { ticker: "FTSEMIB.MI", label: "FTSE MIB",           currency: "EUR" },
];

// Asia-Pacific — all native indices, local currencies
const ASIA = [
  { ticker: "^N225",     label: "Nikkei 225",   currency: "JPY" },
  { ticker: "^HSI",      label: "Hang Seng",    currency: "HKD" },
  { ticker: "000300.SS", label: "CSI 300",      currency: "CNY" },
  { ticker: "^KS11",     label: "KOSPI",        currency: "KRW" },
  { ticker: "^NSEI",     label: "Nifty 50",     currency: "INR" },
  { ticker: "^AXJO",     label: "ASX 200",      currency: "AUD" },
  { ticker: "^TWII",     label: "Taiwan TAIEX", currency: "TWD" },
];

// Emerging Markets
// ^COLCAP absent from Yahoo Finance — ICOLCAP.CL (local ETF on Santiago exchange, COP) is the proxy.
// ^IPSA limited to 1 bar of history — ECH (iShares MSCI Chile ETF, USD) is the proxy.
const EM: Array<{ ticker: string; label: string; currency: string; proxy?: boolean }> = [
  { ticker: "^BVSP",       label: "Bovespa (Brazil)",        currency: "BRL" },
  { ticker: "^MXX",        label: "IPC (Mexico)",            currency: "MXN" },
  { ticker: "ICOLCAP.CL",  label: "Colombia (ICOLCAP proxy)", currency: "COP", proxy: true },
  { ticker: "ECH",         label: "Chile (ECH proxy)",       currency: "USD", proxy: true },
  { ticker: "EEM",         label: "MSCI EM (broad)",         currency: "USD", proxy: true },
];

// ── Return period helpers ────────────────────────────────────────────────────

type ReturnPeriods = {
  "1D": number | null;
  "1W": number | null;
  "1M": number | null;
  "YTD": number | null;
};

function computePeriods(dates: string[], closes: number[]): ReturnPeriods {
  if (closes.length < 2) return { "1D": null, "1W": null, "1M": null, "YTD": null };
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  return {
    "1D": prev ? ((last - prev) / prev) * 100 : null,
    "1W": computeReturn(closes, 7),
    "1M": computeReturn(closes, 30),
    "YTD": computeYTD(dates, closes),
  };
}

// ── Core fetch logic ─────────────────────────────────────────────────────────

type EquityEntry = {
  ticker: string;
  label: string;
  currency?: string;
  price: number | null;
  returns: ReturnPeriods;
  dataStatus: "ok" | "limited" | "error";
  isProxy?: boolean;
  /** True when Yahoo only returns 1 bar of history — multi-period returns are null. */
  limitedHistory?: boolean;
  error?: string;
};

async function fetchEquity(
  ticker: string,
  label: string,
  opts: { isProxy?: boolean; currency?: string } = {}
): Promise<EquityEntry> {
  // 400 calendar days ≈ 265 trading days (1Y) + YTD boundary buffer
  const hist = await fetchHistorical(ticker, 400);

  if (hist.error || hist.closes.length === 0) {
    return {
      ticker, label, currency: opts.currency,
      price: null,
      returns: { "1D": null, "1W": null, "1M": null, "YTD": null },
      dataStatus: "error",
      isProxy: opts.isProxy,
      error: hist.error ?? "No data returned",
    };
  }

  if (hist.limitedHistory) {
    // Only current price + 1D available (e.g. ^IPSA — Yahoo has no chart history)
    return {
      ticker, label, currency: opts.currency,
      price: hist.closes[hist.closes.length - 1] ?? null,
      returns: {
        "1D": computePeriods(hist.dates, hist.closes)["1D"],
        "1W": null, "1M": null, "YTD": null,
      },
      dataStatus: "limited",
      limitedHistory: true,
      isProxy: opts.isProxy,
    };
  }

  return {
    ticker, label, currency: opts.currency,
    price: hist.closes[hist.closes.length - 1] ?? null,
    returns: computePeriods(hist.dates, hist.closes),
    dataStatus: "ok",
    isProxy: opts.isProxy,
  };
}

// ── Sector-relative returns (vs ^GSPC) ───────────────────────────────────────

function relativeReturns(a: ReturnPeriods, b: ReturnPeriods): ReturnPeriods {
  const diff = (x: number | null, y: number | null) =>
    x != null && y != null ? x - y : null;
  return {
    "1D": diff(a["1D"], b["1D"]),
    "1W": diff(a["1W"], b["1W"]),
    "1M": diff(a["1M"], b["1M"]),
    "YTD": diff(a["YTD"], b["YTD"]),
  };
}

// ── GET handler ───────────────────────────────────────────────────────────────

export const maxDuration = 60;

export async function GET() {
  const results: Record<string, EquityEntry> = {};

  // Flatten all ticker groups for sequential fetching (rate-limit safe)
  const allGroups = [
    ...US_BROAD.map((e) => ({ ...e })),
    ...US_SECTORS.map((e) => ({ ...e })),
    ...US_FACTORS.map((e) => ({ ...e })),
    ...EUROPE.map((e) => ({ ...e })),
    ...ASIA.map((e) => ({ ...e })),
    ...EM.map((e) => ({ ...e })),
  ];

  for (const entry of allGroups) {
    results[entry.ticker] = await fetchEquity(entry.ticker, entry.label, {
      isProxy: "proxy" in entry ? Boolean(entry.proxy) : false,
      currency: "currency" in entry ? (entry as any).currency : undefined,
    });
    await sleep(200);
  }

  // Sector returns relative to ^GSPC
  const sp500 = results["^GSPC"];
  const usSectors = US_SECTORS.map(({ ticker }) => ({
    ...results[ticker],
    relativeReturns: sp500 ? relativeReturns(results[ticker].returns, sp500.returns) : null,
  }));

  // Build response groups
  const usBroad  = US_BROAD.map(({ ticker }) => results[ticker]);
  const usFactors = US_FACTORS.map(({ ticker }) => results[ticker]);
  const europe   = EUROPE.map(({ ticker }) => results[ticker]);
  const asia     = ASIA.map(({ ticker }) => results[ticker]);
  const em       = EM.map(({ ticker }) => results[ticker]);

  // ── Server-side validation log ──────────────────────────────────────────────
  console.log("\n══ MarketLens /api/equities ══════════════════════════");
  const groups = [
    { name: "US Broad", entries: usBroad },
    { name: "US Sectors", entries: usSectors },
    { name: "US Factors", entries: usFactors },
    { name: "Europe", entries: europe },
    { name: "Asia", entries: asia },
    { name: "EM", entries: em },
  ];
  let totalOk = 0, totalAll = 0;
  for (const { name, entries } of groups) {
    const ok      = entries.filter((e) => e.dataStatus === "ok").length;
    const limited = entries.filter((e) => e.dataStatus === "limited").length;
    totalOk += ok + limited; totalAll += entries.length;
    const note = limited ? ` (${limited} limited)` : "";
    console.log(`  ${name}: ${ok + limited}/${entries.length}${note}`);
  }
  console.log(`  ── Total: ${totalOk}/${totalAll} tickers OK ──`);
  console.log("══════════════════════════════════════════════════════\n");

  return NextResponse.json({
    asOf: new Date().toISOString(),
    usBroad,
    usSectors,
    usFactors,
    europe,
    asia,
    em,
    _meta: {
      tickersOk: totalOk,
      tickersTotal: totalAll,
      notes: [
        "XLE (SPDR Energy ETF) proxies ^SP500-10 — delisted from Yahoo Finance",
        "XLE (SPDR Energy ETF) proxies ^SP500-10 — delisted from Yahoo Finance",
        "ICOLCAP.CL (local ETF, Santiago exchange, COP) proxies ^COLCAP — absent from Yahoo Finance",
        "ECH (iShares MSCI Chile ETF, USD) proxies ^IPSA — chart history only 1 bar on Yahoo Finance",
        "EEM proxies MSCI EM index — MXEF not available free (per spec)",
        "EEM, MTUM, VLUE, QUAL, USMV, IWF, IWD are ETF proxies per spec",
        "International indices returned in local currency — USD conversion requires FX rates (Phase 1 Step 5)",
      ],
    },
  });
}
