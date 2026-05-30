import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(ticker, label) {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - 400);
  try {
    const r = await yf.chart(ticker, { period1: start, period2: end, interval: "1d" });
    const quotes = r?.quotes ?? [];
    const closes = quotes.map(q => q.adjclose ?? q.close).filter(Boolean);
    const price = closes.at(-1) ?? null;
    const prev  = closes.at(-2);
    const chg   = price && prev ? ((price - prev) / prev * 100) : null;
    const flag  = closes.length > 5 ? "✅" : "❌";
    console.log(`${flag} ${ticker.padEnd(16)} price=${String(price?.toFixed(2) ?? "null").padStart(10)}  ${chg != null ? (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%" : "n/a"}  bars=${closes.length}  currency=${r?.meta?.currency ?? "?"}  ${label}`);
  } catch (e) {
    console.log(`❌ ${ticker.padEnd(16)} ERROR: ${e.message.slice(0, 80)}`);
  }
}

console.log("\n── Proxy replacement validation ─────────────────────────────");
await check("ICOLCAP.CL", "Colombia proxy (replaces GXG)");
await sleep(200);
await check("ECH",        "Chile proxy (replaces ^IPSA)");
console.log();
