import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey"] });

// Check what the raw response looks like for ^SP500-10
const q = await yf.quote("^SP500-10", {}, { validateResult: false });
console.log("Full quote response for ^SP500-10:");
console.log(JSON.stringify(q, null, 2));

// Try historical as well
const end = new Date();
const start = new Date(); start.setDate(start.getDate() - 30);
try {
  const h = await yf.historical("^SP500-10", { period1: start, period2: end, interval: "1d" });
  console.log("\nHistorical rows (last 5):", h.slice(-5));
} catch (e) {
  console.log("\nHistorical error:", e.message);
}

// Also try the alternative ticker format used on Yahoo Finance website
for (const alt of ["^SP500TR", "SPNY", "XLE"]) {
  const a = await yf.quote(alt, {}, { validateResult: false });
  console.log(`\n${alt}: price=${a?.regularMarketPrice}, name=${a?.shortName}`);
}
