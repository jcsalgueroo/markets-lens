import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

// Check what chart() actually returns for ^IPSA across different intervals/ranges
const end = new Date();
const start400 = new Date(); start400.setDate(end.getDate() - 400);
const start30  = new Date(); start30.setDate(end.getDate() - 30);

for (const [label, period1, interval] of [
  ["400d daily",  start400, "1d"],
  ["30d daily",   start30,  "1d"],
  ["400d weekly", start400, "1wk"],
]) {
  try {
    const r = await yf.chart("^IPSA", { period1, period2: end, interval });
    const quotes = r?.quotes ?? [];
    console.log(`${label}: ${quotes.length} bars, last close=${quotes.at(-1)?.close ?? "null"}, meta price=${r?.meta?.regularMarketPrice}`);
  } catch (e) {
    console.log(`${label}: ERROR — ${e.message.slice(0, 80)}`);
  }
}

// Also try the quote endpoint for current data
const q = await yf.quote("^IPSA", {}, { validateResult: false });
console.log(`\nQuote: price=${q?.regularMarketPrice}, change%=${q?.regularMarketChangePercent?.toFixed(2)}, name="${q?.shortName}"`);

// Try alternative tickers
for (const alt of ["IPSA.SN", "^IPSA.SN", "SPIPSA.SN"]) {
  try {
    const a = await yf.quote(alt, {}, { validateResult: false });
    console.log(`Alt ${alt}: price=${a?.regularMarketPrice}`);
  } catch (e) {
    console.log(`Alt ${alt}: error`);
  }
}
