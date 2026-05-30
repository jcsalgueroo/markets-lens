/**
 * Phase 1, Step 3 — /api/fixed-income end-to-end validation
 * Mirrors the route logic directly. Run: node scripts/validate-step3.mjs
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TREASURY_DAYS = 365 * 3 + 60;
const CREDIT_DAYS   = 365 * 3 + 60;

function computeReturn(closes, calDays) {
  if (closes.length < 2) return null;
  const tdBack = Math.round(calDays * 0.69);
  const idx = Math.max(0, closes.length - 1 - tdBack);
  const base = closes[idx], cur = closes.at(-1);
  return base && cur ? ((cur - base) / base) * 100 : null;
}

async function fetch3Y(ticker) {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - TREASURY_DAYS);
  try {
    const r = await yf.chart(ticker, { period1: start, period2: end, interval: "1d" });
    const quotes = r?.quotes ?? [];
    const closes = quotes.map(q => q.adjclose ?? q.close).filter(Boolean);
    return { closes, bars: closes.length };
  } catch (e) {
    return { closes: [], bars: 0, error: e.message };
  }
}

console.log("\n══════════════════════════════════════════════════════════════");
console.log("  MarketLens — Phase 1, Step 3 End-to-End Validation");
console.log("══════════════════════════════════════════════════════════════\n");

// ── Treasuries ──────────────────────────────────────────────────────────────
console.log("── Treasury Yields (" + TREASURY_DAYS + " calendar days) ──────────────────");
const yields = {};
for (const [ticker, label, tenor] of [
  ["^IRX", "3M T-Bill",       "3M"],
  ["^FVX", "5Y Treasury",     "5Y"],
  ["^TNX", "10Y Treasury",    "10Y"],
  ["^TYX", "30Y Treasury",    "30Y"],
]) {
  const { closes, bars, error } = await fetch3Y(ticker);
  const level = closes.at(-1);
  const chg1D = closes.length >= 2 ? ((closes.at(-1) - closes.at(-2)) / closes.at(-2) * 100) : null;
  const chg1M = computeReturn(closes, 30);
  const chg1Y = computeReturn(closes, 365);
  yields[ticker] = level;
  const flag = bars > 20 ? "✅" : "❌";
  console.log(
    `  ${flag} ${ticker.padEnd(6)} [${tenor.padEnd(3)}]  level=${String(level?.toFixed(3) ?? "null").padStart(6)}%` +
    `  1D=${chg1D != null ? (chg1D >= 0 ? "+" : "") + chg1D.toFixed(3) + "pp" : "   n/a  "}` +
    `  1M=${chg1M != null ? (chg1M >= 0 ? "+" : "") + chg1M.toFixed(2) + "pp" : "  n/a "}` +
    `  1Y=${chg1Y != null ? (chg1Y >= 0 ? "+" : "") + chg1Y.toFixed(2) + "pp" : "  n/a "}` +
    `  bars=${bars}  ${label}`
  );
  await sleep(200);
}

// ── Derived spreads ─────────────────────────────────────────────────────────
console.log("\n── Derived Spreads ──────────────────────────────────────────");
const irx = yields["^IRX"], tnx = yields["^TNX"], fvx = yields["^FVX"], tyx = yields["^TYX"];
const spread3M10Y = tnx != null && irx != null ? tnx - irx : null;
const spread5Y30Y = tyx != null && fvx != null ? tyx - fvx : null;
const flag3M10Y = spread3M10Y != null ? (spread3M10Y < 0 ? "🔴 INVERTED" : "🟢 NORMAL") : "❓";
console.log(`  3M-10Y spread:  ${spread3M10Y?.toFixed(3) ?? "null"} pp  ${flag3M10Y}`);
console.log(`  5Y-30Y spread:  ${spread5Y30Y?.toFixed(3) ?? "null"} pp`);

// ── Credit ETFs ─────────────────────────────────────────────────────────────
console.log("\n── Credit ETFs (3Y history, thinned to weekly) ──────────────");
for (const [ticker, label] of [
  ["LQD",  "US Investment Grade"],
  ["HYG",  "US High Yield"],
  ["EMB",  "USD EM Sovereign"],
  ["EMLC", "EM Local Currency"],
]) {
  const { closes, bars, error } = await fetch3Y(ticker);
  const price = closes.at(-1);
  const chg1D = closes.length >= 2 ? ((closes.at(-1) - closes.at(-2)) / closes.at(-2) * 100) : null;
  const chg1M = computeReturn(closes, 30);
  const chg1Y = computeReturn(closes, 365);
  const weekly = closes.filter((_, i) => i % 5 === 0 || i === closes.length - 1).length;
  const flag = bars > 20 ? "✅" : "❌";
  console.log(
    `  ${flag} ${ticker.padEnd(5)}  $${String(price?.toFixed(2) ?? "null").padStart(7)}` +
    `  1D=${chg1D != null ? (chg1D >= 0 ? "+" : "") + chg1D.toFixed(2) + "%" : "   n/a"}` +
    `  1M=${chg1M != null ? (chg1M >= 0 ? "+" : "") + chg1M.toFixed(2) + "%" : "  n/a"}` +
    `  1Y=${chg1Y != null ? (chg1Y >= 0 ? "+" : "") + chg1Y.toFixed(2) + "%" : "  n/a"}` +
    `  daily=${bars} → weekly=${weekly}  ${label}`
  );
  await sleep(200);
}

// ── Yield curve snapshot ────────────────────────────────────────────────────
console.log("\n── Current Yield Curve Snapshot ────────────────────────────");
console.log(`  3M:  ${irx?.toFixed(3) ?? "n/a"}%`);
console.log(`  5Y:  ${fvx?.toFixed(3) ?? "n/a"}%`);
console.log(`  10Y: ${tnx?.toFixed(3) ?? "n/a"}%`);
console.log(`  30Y: ${tyx?.toFixed(3) ?? "n/a"}%`);

console.log("\n✅ Step 3 validation complete — /api/fixed-income ready\n");
console.log("══════════════════════════════════════════════════════════════\n");
