/**
 * Phase 1, Step 2 — Full equities validation
 * Mirrors the complete /api/equities ticker registry.
 * Run: node scripts/validate-all-equities.mjs
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GROUPS = {
  "US Broad": [
    { ticker: "^GSPC", label: "S&P 500" },
    { ticker: "^NDX",  label: "Nasdaq 100" },
    { ticker: "^RUT",  label: "Russell 2000" },
    { ticker: "^DJI",  label: "Dow Jones" },
  ],
  "US Sectors (^SP500-XX)": [
    { ticker: "^SP500-45", label: "Information Technology" },
    { ticker: "^SP500-40", label: "Financials" },
    { ticker: "XLE",       label: "Energy (⚠ ETF proxy — ^SP500-10 delisted)" },
    { ticker: "^SP500-35", label: "Health Care" },
    { ticker: "^SP500-20", label: "Industrials" },
    { ticker: "^SP500-30", label: "Consumer Staples" },
    { ticker: "^SP500-25", label: "Consumer Discretionary" },
    { ticker: "^SP500-60", label: "Real Estate" },
    { ticker: "^SP500-55", label: "Utilities" },
    { ticker: "^SP500-15", label: "Materials" },
    { ticker: "^SP500-50", label: "Communication Services" },
  ],
  "US Factors (ETFs)": [
    { ticker: "MTUM", label: "Momentum" },
    { ticker: "VLUE", label: "Value" },
    { ticker: "QUAL", label: "Quality" },
    { ticker: "USMV", label: "Min Vol" },
    { ticker: "IWF",  label: "R1000 Growth" },
    { ticker: "IWD",  label: "R1000 Value" },
  ],
  "Europe": [
    { ticker: "^STOXX50E",  label: "Euro Stoxx 50" },
    { ticker: "^STOXX",     label: "STOXX Europe 600" },
    { ticker: "^GDAXI",     label: "DAX" },
    { ticker: "^FCHI",      label: "CAC 40" },
    { ticker: "^FTSE",      label: "FTSE 100" },
    { ticker: "^IBEX",      label: "IBEX 35" },
    { ticker: "FTSEMIB.MI", label: "FTSE MIB" },
  ],
  "Asia / Pacific": [
    { ticker: "^N225",     label: "Nikkei 225" },
    { ticker: "^HSI",      label: "Hang Seng" },
    { ticker: "000300.SS", label: "CSI 300" },
    { ticker: "^KS11",     label: "KOSPI" },
    { ticker: "^NSEI",     label: "Nifty 50" },
    { ticker: "^AXJO",     label: "ASX 200" },
    { ticker: "^TWII",     label: "Taiwan TAIEX" },
  ],
  "Emerging Markets": [
    { ticker: "^BVSP", label: "Bovespa (Brazil)" },
    { ticker: "^MXX",  label: "IPC (Mexico)" },
    { ticker: "GXG",   label: "Colombia (⚠ GXG ETF — ^COLCAP absent from Yahoo)" },
    { ticker: "^IPSA", label: "IPSA (Chile)" },
    { ticker: "EEM",   label: "MSCI EM broad (ETF fallback)" },
  ],
};

async function fetchAndCheck(ticker) {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - 400);
  try {
    const result = await yf.chart(ticker, { period1: start, period2: end, interval: "1d" });
    const quotes = result?.quotes ?? [];
    const closes = quotes.map(q => q.adjclose ?? q.close).filter(Boolean);
    const price = closes.at(-1) ?? null;
    // quick 1D return
    const prev = closes.at(-2);
    const change1D = price && prev ? ((price - prev) / prev) * 100 : null;
    return { price, change1D, bars: closes.length, status: price != null && closes.length > 20 ? "ok" : "no_data" };
  } catch (e) {
    return { price: null, change1D: null, bars: 0, status: "error", error: e.message.slice(0, 80) };
  }
}

console.log("\n══════════════════════════════════════════════════════════════");
console.log("  MarketLens — Phase 1 Step 2 Full Equities Validation");
console.log("  Using chart() — same method as /api/equities route");
console.log("══════════════════════════════════════════════════════════════");

let grandOk = 0, grandTotal = 0;

for (const [groupName, tickers] of Object.entries(GROUPS)) {
  console.log(`\n── ${groupName} ${"─".repeat(Math.max(0, 55 - groupName.length))}`);
  let groupOk = 0;
  for (const { ticker, label } of tickers) {
    const r = await fetchAndCheck(ticker);
    if (r.status === "ok") { groupOk++; grandOk++; }
    grandTotal++;
    const flag = r.status === "ok" ? "✅" : "❌";
    const priceStr = r.price != null ? String(r.price.toFixed(2)).padStart(12) : "        null";
    const chgStr = r.change1D != null ? `${r.change1D >= 0 ? "+" : ""}${r.change1D.toFixed(2)}%`.padStart(9) : "      n/a";
    const barsStr = `${r.bars}d`.padStart(5);
    const errNote = r.error ? `  ⚠ ${r.error}` : "";
    console.log(`  ${flag} ${ticker.padEnd(14)} ${priceStr}  ${chgStr}  ${barsStr}  ${label}${errNote}`);
    await sleep(200);
  }
  console.log(`     Group total: ${groupOk}/${tickers.length}`);
}

console.log(`\n══ Grand total: ${grandOk}/${grandTotal} tickers returning history ══`);
if (grandOk === grandTotal) {
  console.log("✅ ALL TICKERS VALIDATED — /api/equities is complete\n");
} else {
  console.log(`⚠️  ${grandTotal - grandOk} ticker(s) need attention\n`);
}
console.log("══════════════════════════════════════════════════════════════\n");
