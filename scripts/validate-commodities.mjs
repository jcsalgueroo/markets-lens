/**
 * Phase 1, Step 4 validation — commodity futures + DBA
 * Run: node scripts/validate-commodities.mjs
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TICKERS = [
  // Energy
  { ticker: "CL=F",  label: "WTI Crude Oil",           group: "Energy" },
  { ticker: "BZ=F",  label: "Brent Crude Oil",          group: "Energy" },
  { ticker: "NG=F",  label: "Natural Gas",              group: "Energy" },
  // Metals
  { ticker: "GC=F",  label: "Gold",                     group: "Metals" },
  { ticker: "SI=F",  label: "Silver",                   group: "Metals" },
  { ticker: "HG=F",  label: "Copper (Dr. Copper)",      group: "Metals" },
  // Agriculture
  { ticker: "ZW=F",  label: "Wheat",                    group: "Agriculture" },
  { ticker: "ZC=F",  label: "Corn",                     group: "Agriculture" },
  { ticker: "DBA",   label: "Broad Agriculture (ETF)",  group: "Agriculture" },
];

const HISTORY_DAYS = 400; // 265 trading days + buffer

console.log("\n══════════════════════════════════════════════════════════════");
console.log("  MarketLens — Phase 1, Step 4 Validation");
console.log("  Commodity futures + DBA ETF ticker check");
console.log("══════════════════════════════════════════════════════════════\n");

let currentGroup = "";
let ok = 0;
const prices = {};

for (const { ticker, label, group } of TICKERS) {
  if (group !== currentGroup) {
    if (currentGroup) console.log();
    console.log(`── ${group} ${"─".repeat(Math.max(0, 50 - group.length))}`);
    currentGroup = group;
  }

  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - HISTORY_DAYS);
  try {
    const r = await yf.chart(ticker, { period1: start, period2: end, interval: "1d" });
    const quotes = r?.quotes ?? [];
    const closes = quotes.map(q => q.adjclose ?? q.close).filter(Boolean);
    const price = closes.at(-1) ?? null;
    const prev  = closes.at(-2);
    const chg   = price && prev ? ((price - prev) / prev * 100) : null;
    const currency = r?.meta?.currency ?? "?";
    prices[ticker] = price;
    const flag = closes.length > 20 ? "✅" : "❌";
    if (closes.length > 20) ok++;
    console.log(
      `  ${flag} ${ticker.padEnd(6)}  ${String(price?.toFixed(3) ?? "null").padStart(10)}  ` +
      `${(chg != null ? (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%" : "n/a").padStart(8)}  ` +
      `bars=${closes.length}  [${currency}]  ${label}`
    );
  } catch (e) {
    console.log(`  ❌ ${ticker.padEnd(6)}  ERROR: ${e.message.slice(0, 80)}`);
  }
  await sleep(200);
}

// Gold/Copper ratio
const gc = prices["GC=F"], hg = prices["HG=F"];
const ratio = gc && hg ? gc / hg : null;
console.log(`\n── Derived Metrics ──────────────────────────────────────────`);
console.log(`  Gold/Copper ratio: ${ratio?.toFixed(2) ?? "n/a"}  (Gold=$${gc?.toFixed(2)}, Copper=$${hg?.toFixed(3)})`);
console.log(`  Brent in USD: $${prices["BZ=F"]?.toFixed(2) ?? "n/a"}/bbl  (× USDCOP rate in Step 5 → Oil in COP)`);

console.log(`\n══ Result: ${ok}/${TICKERS.length} tickers validated ══`);
if (ok === TICKERS.length) console.log("✅ ALL COMMODITIES OK — safe to build /api/commodities\n");
else console.log("⚠️  Some tickers failed\n");
console.log("══════════════════════════════════════════════════════════════\n");
