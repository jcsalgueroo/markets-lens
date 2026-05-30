/**
 * Phase 1, Step 3 validation — fixed income tickers
 * Treasuries: ^IRX, ^FVX, ^TNX, ^TYX  (yields returned as % levels, not prices)
 * Credit ETFs: LQD, HYG, EMB, EMLC
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TICKERS = [
  // Treasury yield indices — Yahoo reports as yield level (e.g. 4.35 = 4.35%)
  { ticker: "^IRX",  label: "13-week T-Bill yield",   type: "treasury" },
  { ticker: "^FVX",  label: "5-year Treasury yield",  type: "treasury" },
  { ticker: "^TNX",  label: "10-year Treasury yield", type: "treasury" },
  { ticker: "^TYX",  label: "30-year Treasury yield", type: "treasury" },
  // Credit ETFs
  { ticker: "LQD",   label: "US IG Corp Bond",        type: "credit" },
  { ticker: "HYG",   label: "US HY Corp Bond",        type: "credit" },
  { ticker: "EMB",   label: "USD EM Bond",            type: "credit" },
  { ticker: "EMLC",  label: "EM Local Currency Bond", type: "credit" },
];

// Treasury tickers need 3Y history per spec; credit ETFs need 3Y weekly
const HISTORY_DAYS = { treasury: 365 * 3 + 30, credit: 365 * 3 + 30 };

console.log("\n══════════════════════════════════════════════════════════════");
console.log("  MarketLens — Phase 1, Step 3 Validation");
console.log("  Fixed Income ticker check (treasury yields + credit ETFs)");
console.log("══════════════════════════════════════════════════════════════\n");

for (const { ticker, label, type } of TICKERS) {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - HISTORY_DAYS[type]);
  try {
    const r = await yf.chart(ticker, { period1: start, period2: end, interval: "1d" });
    const quotes = r?.quotes ?? [];
    const closes = quotes.map(q => q.adjclose ?? q.close).filter(Boolean);
    const price = closes.at(-1);
    const prev  = closes.at(-2);
    const chg   = price && prev ? ((price - prev) / prev * 100) : null;
    const flag  = closes.length > 20 ? "✅" : "❌";
    const typeTag = type === "treasury" ? "[yield %]" : "[price  ]";
    console.log(
      `${flag} ${ticker.padEnd(6)} ${typeTag} level=${String(price?.toFixed(3) ?? "null").padStart(8)}  1D=${chg != null ? (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%" : "n/a"}  bars=${closes.length}  ${label}`
    );
  } catch (e) {
    console.log(`❌ ${ticker.padEnd(6)}  ERROR: ${e.message.slice(0, 80)}`);
  }
  await sleep(200);
}

console.log("\n══════════════════════════════════════════════════════════════\n");
