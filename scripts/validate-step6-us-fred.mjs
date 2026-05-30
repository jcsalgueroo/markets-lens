/**
 * Confirm core US FRED public CSV series — the ones that need no key
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(id, label) {
  try {
    const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`,
      { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    const lines = text.trim().split("\n").filter(l => !l.startsWith("DATE") && !l.endsWith(",."));
    const last = lines.at(-1);
    const ok = res.ok && lines.length > 3;
    console.log(`  ${ok ? "✅" : "❌"} ${id.padEnd(14)} ${label.padEnd(35)} last: ${last}`);
  } catch (e) {
    console.log(`  ❌ ${id.padEnd(14)} ${label.padEnd(35)} ERROR: ${e.message.slice(0,40)}`);
  }
  await sleep(300);
}

console.log("\n── Core US FRED series (no key needed) ──────────────────────");
await check("CPIAUCSL", "US CPI YoY (monthly)");
await check("PCEPILFE", "Core PCE (monthly)");
await check("GDP",      "US GDP (quarterly)");
await check("UNRATE",   "US Unemployment (monthly)");
await check("FEDFUNDS", "Fed Funds Rate (daily)");
await check("T10YIE",   "10Y Breakeven Inflation (daily)");
await check("DFII10",   "Real 10Y Treasury Yield (daily)");
await check("CAPE",     "Shiller CAPE (monthly)");
console.log("\n── ECB rates on FRED ─────────────────────────────────────────");
await check("ECBDFR",   "ECB Deposit Facility Rate");
await check("ECBMLFR",  "ECB Marginal Lending Rate");
await check("ECBMRRFR", "ECB Main Refi Rate (fixed)");
console.log();
