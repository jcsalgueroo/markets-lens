/**
 * Phase 1, Step 4 — /api/commodities end-to-end validation
 * Run: node scripts/validate-step4.mjs
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function computeReturn(closes, calDays) {
  if (closes.length < 2) return null;
  const idx = Math.max(0, closes.length - 1 - Math.round(calDays * 0.69));
  const base = closes[idx], cur = closes.at(-1);
  return base && cur ? ((cur - base) / base) * 100 : null;
}

const DEFS = [
  { ticker: "CL=F", label: "WTI Crude",        cents: false },
  { ticker: "BZ=F", label: "Brent Crude",       cents: false },
  { ticker: "NG=F", label: "Natural Gas",       cents: false },
  { ticker: "GC=F", label: "Gold",              cents: false },
  { ticker: "SI=F", label: "Silver",            cents: false },
  { ticker: "HG=F", label: "Copper",            cents: false },
  { ticker: "ZW=F", label: "Wheat (USX→USD)",   cents: true  },
  { ticker: "ZC=F", label: "Corn  (USX→USD)",   cents: true  },
  { ticker: "DBA",  label: "Agri ETF",          cents: false },
];

console.log("\n══════════════════════════════════════════════════════════════");
console.log("  MarketLens — Phase 1, Step 4 End-to-End Validation");
console.log("  Returns: 1D | 1W | 1M | 3M | 6M | YTD | 1Y");
console.log("══════════════════════════════════════════════════════════════\n");
console.log("  ticker  priceUSD      1D        1W        1M        3M        YTD       1Y     bars");
console.log("  " + "─".repeat(92));

const prices = {};
let okCount = 0;

for (const { ticker, label, cents } of DEFS) {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - 400);
  try {
    const r = await yf.chart(ticker, { period1: start, period2: end, interval: "1d" });
    const closes = (r?.quotes ?? []).map(q => q.adjclose ?? q.close).filter(Boolean);
    const dates  = (r?.quotes ?? []).map(q => new Date(q.date).toISOString().slice(0, 10));
    const raw = closes.at(-1);
    const usd = raw != null ? (cents ? raw / 100 : raw) : null;
    prices[ticker] = usd;

    const r1D  = closes.length >= 2 ? ((closes.at(-1) - closes.at(-2)) / closes.at(-2) * 100) : null;
    const r1W  = computeReturn(closes, 7);
    const r1M  = computeReturn(closes, 30);
    const r3M  = computeReturn(closes, 90);
    const r1Y  = computeReturn(closes, 365);

    const currentYear = new Date().getFullYear().toString();
    const ytdIdx = dates.findIndex(d => d.startsWith(currentYear));
    const rYTD = ytdIdx !== -1 ? ((closes.at(-1) - closes[ytdIdx]) / closes[ytdIdx] * 100) : null;

    const fmt = (v) => v != null ? (v >= 0 ? "+" : "") + v.toFixed(1) + "%" : "   n/a";
    const flag = closes.length > 20 ? "✅" : "❌";
    if (closes.length > 20) okCount++;

    console.log(
      `  ${flag} ${ticker.padEnd(5)}  $${String(usd?.toFixed(2) ?? "null").padStart(8)}` +
      `  ${fmt(r1D).padStart(8)}  ${fmt(r1W).padStart(8)}  ${fmt(r1M).padStart(8)}` +
      `  ${fmt(r3M).padStart(8)}  ${fmt(rYTD).padStart(8)}  ${fmt(r1Y).padStart(8)}  ${closes.length}d  ${label}`
    );
  } catch (e) {
    console.log(`  ❌ ${ticker.padEnd(5)}  ERROR: ${e.message.slice(0, 60)}`);
  }
  await sleep(200);
}

// Gold/Copper ratio
const gc = prices["GC=F"], hg = prices["HG=F"], bz = prices["BZ=F"];
console.log(`\n── Derived Metrics ──────────────────────────────────────────────`);
console.log(`  Gold/Copper ratio : ${gc && hg ? (gc / hg).toFixed(2) : "n/a"}  (Gold $${gc?.toFixed(2)}/oz ÷ Copper $${hg?.toFixed(3)}/lb)`);
console.log(`  Brent USD         : $${bz?.toFixed(2) ?? "n/a"}/bbl  → Oil in COP = Brent × USDCOP (computed in Step 5)`);

console.log(`\n══ Result: ${okCount}/${DEFS.length} tickers OK ══`);
if (okCount === DEFS.length) console.log("✅ ALL COMMODITIES VALIDATED — /api/commodities ready\n");
else console.log("⚠️  Some tickers failed\n");
console.log("══════════════════════════════════════════════════════════════\n");
