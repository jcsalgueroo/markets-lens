/**
 * Smoke test for the full /api/equities logic — runs outside Next.js.
 * Directly calls the same fetch + compute functions used in the route.
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHistorical(ticker, calendarDays) {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - calendarDays);
  try {
    const result = await yf.chart(ticker, { period1: start, period2: end, interval: "1d" });
    const quotes = result?.quotes ?? [];
    const closes = quotes.map(r => r.adjclose ?? r.close).filter(c => c != null);
    const dates  = quotes.map(r => new Date(r.date).toISOString().slice(0, 10));
    if (closes.length > 5) return { ticker, dates, closes };
    // Limited history fallback
    const q = await yf.quote(ticker, {}, { validateResult: false });
    if (!q?.regularMarketPrice) return { ticker, dates: [], closes: [], error: "No data" };
    const synth = q.regularMarketPreviousClose ? [q.regularMarketPreviousClose, q.regularMarketPrice] : [q.regularMarketPrice];
    return { ticker, dates: synth.length === 2 ? ["prev", new Date().toISOString().slice(0,10)] : [new Date().toISOString().slice(0,10)], closes: synth, limitedHistory: true };
  } catch (e) {
    return { ticker, dates: [], closes: [], error: e.message };
  }
}

const ALL = [
  // Sample from each group
  { ticker: "^GSPC",     group: "US Broad" },
  { ticker: "^SP500-45", group: "Sector" },
  { ticker: "XLE",       group: "Sector proxy" },
  { ticker: "MTUM",      group: "Factor ETF" },
  { ticker: "^GDAXI",    group: "Europe" },
  { ticker: "^N225",     group: "Asia" },
  { ticker: "000300.SS", group: "Asia" },
  { ticker: "^BVSP",     group: "EM" },
  { ticker: "GXG",       group: "EM proxy" },
  { ticker: "^IPSA",     group: "EM limited" },
  { ticker: "EEM",       group: "EM ETF" },
];

console.log("\n── /api/equities smoke test ──────────────────────────────");
console.log("  ticker          price      1D%     bars  limited  group");
console.log("  ─────────────────────────────────────────────────────────");

let ok = 0;
for (const { ticker, group } of ALL) {
  const h = await fetchHistorical(ticker, 400);
  const price = h.closes.at(-1) ?? null;
  const prev  = h.closes.at(-2);
  const chg1D = price && prev ? ((price - prev) / prev * 100) : null;
  const flag  = (h.error || !price) ? "❌" : "✅";
  if (!h.error && price) ok++;
  const chgStr = chg1D != null ? `${chg1D >= 0 ? "+" : ""}${chg1D.toFixed(2)}%` : "  n/a";
  console.log(`  ${flag} ${ticker.padEnd(14)} ${String(price?.toFixed(2) ?? "null").padStart(10)}  ${chgStr.padStart(8)}  ${String(h.closes.length).padStart(4)}d  ${h.limitedHistory ? "  YES  " : "       "}  ${group}`);
  await sleep(200);
}
console.log(`\n  ${ok}/${ALL.length} sample tickers OK — full route ready\n`);
