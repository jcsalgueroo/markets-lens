/**
 * Step 5 — Part 1: validate Yahoo Finance tickers for Colombia
 * USDCOP=X (TRM), ^VIX, ^DXY
 * Also probe for any Yahoo Finance TES yield tickers
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const end = new Date();
const start3Y = new Date(); start3Y.setDate(start3Y.getDate() - 365 * 3 + 30);

async function checkChart(ticker, label, days = 400) {
  const s = new Date(); s.setDate(s.getDate() - days);
  try {
    const r = await yf.chart(ticker, { period1: s, period2: end, interval: "1d" });
    const closes = (r?.quotes ?? []).map(q => q.adjclose ?? q.close).filter(Boolean);
    const price = closes.at(-1);
    const chg = closes.length >= 2 ? ((closes.at(-1) - closes.at(-2)) / closes.at(-2) * 100) : null;
    const flag = closes.length > 20 ? "✅" : "❌";
    console.log(`  ${flag} ${ticker.padEnd(14)} ${String(price?.toFixed(4) ?? "null").padStart(12)}  ${(chg != null ? (chg >= 0 ? "+" : "") + chg.toFixed(3) + "%" : "n/a").padStart(9)}  bars=${closes.length}  ${label}`);
    return { price, bars: closes.length, ok: closes.length > 20 };
  } catch (e) {
    console.log(`  ❌ ${ticker.padEnd(14)} ERROR: ${e.message.slice(0, 80)}`);
    return { price: null, bars: 0, ok: false };
  }
}

console.log("\n── Yahoo Finance: Colombia-relevant tickers ─────────────────");
await checkChart("USDCOP=X", "USD/COP spot (TRM proxy)", 365 * 3 + 30);
await sleep(200);
await checkChart("^DXY",     "US Dollar Index",          400);
await sleep(200);
await checkChart("^VIX",     "CBOE VIX",                 400);
await sleep(200);
await checkChart("BZ=F",     "Brent Crude (for oil/COP)",400);
await sleep(200);

// Probe Yahoo Finance for Colombian government bond tickers
console.log("\n── Probing Yahoo Finance for TES yield tickers ─────────────");
const tesCandidates = [
  "COT2Y=RR", "COT5Y=RR", "COT10Y=RR",   // Reuters-style
  "CO2YT=RR", "CO5YT=RR", "CO10YT=RR",
  "COGVT2Y=", "COGVT10Y=",
  "COP2Y=X",  "COP5Y=X",
  "^COLTES2", "^COLTES10",
  "TES.BC",
];
for (const t of tesCandidates) {
  try {
    const q = await yf.quote(t, {}, { validateResult: false });
    const p = q?.regularMarketPrice ?? null;
    if (p != null) console.log(`  ✅ ${t.padEnd(16)} price=${p}  name="${q?.shortName ?? ""}"`);
    else           console.log(`  ❌ ${t.padEnd(16)} null`);
  } catch (e) {
    console.log(`  ❌ ${t.padEnd(16)} error`);
  }
  await sleep(150);
}
console.log();
