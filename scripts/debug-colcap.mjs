import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

// Try every known Yahoo Finance variation for the Colombian stock index
const candidates = [
  "^COLCAP",
  "COLCAP",
  "COLCAP.BC",   // Bolsa de Colombia suffix
  "^IBOC",       // alternative symbol sometimes used
  "IBOC.BC",
  "COLCAP=X",
  "COL",
  "GXG",         // Global X MSCI Colombia ETF — most liquid Colombian equity ETF
];

for (const ticker of candidates) {
  try {
    const q = await yf.quote(ticker, {}, { validateResult: false });
    const price = q?.regularMarketPrice ?? null;
    const flag = price != null ? "✅" : "❌";
    console.log(`${flag} ${ticker.padEnd(14)} price=${price ?? "null"}  name="${q?.shortName ?? ""}"`);
  } catch (e) {
    console.log(`❌ ${ticker.padEnd(14)} error: ${e.message.slice(0, 80)}`);
  }
}

// Also try search to find what Yahoo calls it
try {
  const s = await yf.search("COLCAP Colombia stock index", { newsCount: 0, quotesCount: 5 });
  console.log("\nSearch results for 'COLCAP Colombia stock index':");
  s.quotes?.forEach(q => console.log(`  ${q.symbol.padEnd(14)} ${q.shortname ?? q.longname ?? ""}`));
} catch (e) {
  console.log("Search error:", e.message);
}
