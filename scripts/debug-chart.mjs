import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const end = new Date();
const start = new Date(); start.setDate(start.getDate() - 5);

// Try chart() for ^SP500-10 (Energy sector)
try {
  const c = await yf.chart("^SP500-10", { period1: start, period2: end, interval: "1d" });
  console.log("^SP500-10 chart() meta:", c.meta?.symbol, "regularMarketPrice:", c.meta?.regularMarketPrice);
  console.log("Quotes length:", c.quotes?.length);
} catch (e) {
  console.log("^SP500-10 chart() error:", e.message);
}

// Confirm chart() works for a known sector
try {
  const c = await yf.chart("^SP500-45", { period1: start, period2: end, interval: "1d" });
  console.log("\n^SP500-45 chart() meta:", c.meta?.symbol, "price:", c.meta?.regularMarketPrice);
  console.log("Quotes length:", c.quotes?.length);
  if (c.quotes?.length > 0) console.log("Last close:", c.quotes.at(-1)?.close);
} catch (e) {
  console.log("^SP500-45 chart() error:", e.message);
}
