/**
 * Phase 1, Step 1 validation script
 * Run: node scripts/validate-sectors.mjs
 * Confirms all ^SP500-XX sector tickers return data from yahoo-finance2.
 */
import { default as YF } from "yahoo-finance2";
const yahooFinance = new YF({ suppressNotices: ["yahooSurvey"] });

// ^SP500-10 (Energy) confirmed delisted on Yahoo Finance — XLE (SPDR Energy ETF) is the proxy.
const SECTORS = [
  { ticker: "^SP500-45", label: "Information Technology", index: true },
  { ticker: "^SP500-40", label: "Financials",             index: true },
  { ticker: "XLE",       label: "Energy (⚠ ETF proxy)",  index: false },
  { ticker: "^SP500-35", label: "Health Care",            index: true },
  { ticker: "^SP500-20", label: "Industrials",            index: true },
  { ticker: "^SP500-30", label: "Consumer Staples",       index: true },
  { ticker: "^SP500-25", label: "Consumer Discretionary", index: true },
  { ticker: "^SP500-60", label: "Real Estate",            index: true },
  { ticker: "^SP500-55", label: "Utilities",              index: true },
  { ticker: "^SP500-15", label: "Materials",              index: true },
  { ticker: "^SP500-50", label: "Communication Services", index: true },
];

const US_BROAD = [
  { ticker: "^GSPC", label: "S&P 500" },
  { ticker: "^NDX",  label: "Nasdaq 100" },
  { ticker: "^RUT",  label: "Russell 2000" },
  { ticker: "^DJI",  label: "Dow Jones" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOne(ticker) {
  try {
    // Use quote (fastest) for presence check
    const q = await yahooFinance.quote(ticker, {}, { validateResult: false });
    const price = q?.regularMarketPrice ?? null;
    const change = q?.regularMarketChangePercent ?? null;
    return { ticker, price, change1D: change, status: price != null ? "ok" : "no_price", name: q?.shortName ?? "" };
  } catch (err) {
    return { ticker, price: null, change1D: null, status: "error", error: String(err).slice(0, 120) };
  }
}

console.log("\n══════════════════════════════════════════════════════");
console.log("  MarketLens — Phase 1, Step 1 Validation");
console.log("  yahoo-finance2 sector ticker check");
console.log("══════════════════════════════════════════════════════\n");

console.log("── US Broad Indices ──────────────────────────────────");
for (const { ticker, label } of US_BROAD) {
  const r = await fetchOne(ticker);
  const flag = r.status === "ok" ? "✅" : "❌";
  const chg = r.change1D != null ? `${r.change1D > 0 ? "+" : ""}${r.change1D.toFixed(2)}%` : "n/a";
  console.log(`${flag} ${ticker.padEnd(12)} ${String(r.price ?? "null").padStart(10)}  ${chg.padStart(8)}  ${label}`);
  await sleep(200);
}

console.log("\n── S&P 500 Sector Indices (^SP500-XX) ────────────────");
let okCount = 0;
const results = [];
for (const { ticker, label } of SECTORS) {
  const r = await fetchOne(ticker);
  results.push({ ...r, label });
  if (r.status === "ok") okCount++;
  const flag = r.status === "ok" ? "✅" : "❌";
  const chg = r.change1D != null ? `${r.change1D > 0 ? "+" : ""}${r.change1D.toFixed(2)}%` : "n/a";
  const errNote = r.error ? `  ⚠ ${r.error.slice(0, 80)}` : "";
  console.log(`${flag} ${ticker.padEnd(14)} ${String(r.price ?? "null").padStart(10)}  ${chg.padStart(8)}  ${label}${errNote}`);
  await sleep(200);
}

console.log(`\n── Result: ${okCount}/${SECTORS.length} sector tickers returned clean data ──`);
if (okCount === SECTORS.length) {
  console.log("✅ ALL SECTORS VALIDATED — safe to build UI dependent on ^SP500-XX\n");
} else {
  console.log("⚠️  Some sectors failed — review errors above before building UI\n");
  const failed = results.filter((r) => r.status !== "ok");
  console.log("Failed tickers:", failed.map((r) => r.ticker).join(", "));
}
console.log("══════════════════════════════════════════════════════\n");
