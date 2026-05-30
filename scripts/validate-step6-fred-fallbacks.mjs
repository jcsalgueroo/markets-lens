/**
 * Step 6 — FRED series for ECB rates, OECD CLI, and country CPI
 * FRED hosts many ECB and OECD series natively.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkFredCsv(id, label) {
  try {
    const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`,
      { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    const lines = text.trim().split("\n");
    // Filter out header and "." (missing) values
    const data = lines.slice(1).filter(l => !l.endsWith(",.") && !l.endsWith(","));
    const last3 = data.slice(-3);
    const ok = res.ok && data.length > 5;
    const flag = ok ? "✅" : "❌";
    const reason = !res.ok ? `HTTP ${res.status}` : data.length <= 5 ? `only ${data.length} non-missing values` : "";
    console.log(`  ${flag} ${id.padEnd(26)} (${label}) ${reason}`);
    if (ok) last3.forEach(l => console.log(`     ${l}`));
    return ok;
  } catch (e) {
    console.log(`  ❌ ${id.padEnd(26)} ERROR: ${e.message.slice(0,60)}`);
    return false;
  }
}

// ── ECB rates on FRED ─────────────────────────────────────────────────────────
console.log("\n── ECB policy rates via FRED ────────────────────────────────");
await checkFredCsv("ECBDFR",   "ECB Deposit Facility Rate");        await sleep(200);
await checkFredCsv("ECBMLFR",  "ECB Marginal Lending Facility Rate"); await sleep(200);
await checkFredCsv("ECBMRRFR", "ECB Main Refinancing Rate (fixed)"); await sleep(200);
await checkFredCsv("ECBRIR",   "ECB Main Refi (alt ID)");           await sleep(200);

// ── OECD CLI via FRED ─────────────────────────────────────────────────────────
console.log("\n── OECD CLI via FRED ────────────────────────────────────────");
// FRED OECD CLI series: pattern {COUNTRY}LOLITONOBSAM or similar
const cliSeries = [
  ["USALOLITONOBSAM",  "USA CLI"],
  ["CHNLOLITONOBSAM",  "China CLI"],
  ["JPNLOLITONOBSAM",  "Japan CLI"],
  ["KORLOLITONOBSAM",  "Korea CLI"],
  ["BRALOLITONOBSAM",  "Brazil CLI"],
  ["MEXLOLITONOBSAM",  "Mexico CLI"],
  ["COLLOLITONOBSAM",  "Colombia CLI"],
  ["EA19LOLITONOBSAM", "Euro Area CLI"],
  ["G-20LOLITONOBSAM", "G20 CLI"],
  // Try alternative suffixes
  ["USALOLITONOSTSAM",  "USA CLI (OSTSAM)"],
  ["USALOLITONORUBSAM", "USA CLI (NORUBSAM)"],
];
for (const [id, label] of cliSeries) {
  await checkFredCsv(id, label);
  await sleep(200);
}

// ── Country CPI via FRED ──────────────────────────────────────────────────────
console.log("\n── Developed market CPI via FRED ────────────────────────────");
const cpiSeries = [
  ["JPNCPIALLMINMEI",  "Japan CPI all (MNM)"],
  ["KORCPIALLMINMEI",  "Korea CPI all (MNM)"],
  ["AUSCPIALLQINMEI",  "Australia CPI (quarterly)"],
  ["GBRCPIALLMINMEI",  "UK CPI all (MNM)"],
  ["DEUCPIALLMINMEI",  "Germany CPI all (MNM)"],
  ["FRACPIALLMINMEI",  "France CPI all (MNM)"],
  // YoY growth versions
  ["JPNCPALTT01GYSAM", "Japan CPI YoY (GYSAM)"],
  ["KORCPALTT01GYSAM", "Korea CPI YoY"],
  ["GBRCPALTT01GYSAM", "UK CPI YoY"],
  ["DEUCPALTT01GYSAM", "Germany CPI YoY"],
  ["FRACPALTT01GYSAM", "France CPI YoY"],
  ["AUSCPALTT01GYSAM", "Australia CPI YoY"],
];
for (const [id, label] of cpiSeries) {
  await checkFredCsv(id, label);
  await sleep(200);
}

console.log();
