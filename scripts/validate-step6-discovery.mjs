/**
 * Step 6 — Discover correct ECB and OECD series identifiers
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, label) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch {}
    console.log(`  ${res.ok ? "✅" : "❌"} [${res.status}] ${label}`);
    if (text.length < 2000) console.log(`     ${text.replace(/\n/g," ").slice(0,300)}`);
    return { ok: res.ok, json, text };
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message.slice(0,80)}`);
    return { ok: false };
  }
}

// ── ECB: inspect HICP obs structure ──────────────────────────────────────────
console.log("\n── ECB HICP — inspect raw JSON shape ────────────────────────");
const hicp = await get(
  "https://data-api.ecb.europa.eu/service/data/ICP/M.U2.N.000000.4.ANR?lastNObservations=3&format=jsondata",
  "ECB HICP raw"
);
if (hicp.json) {
  const ds = hicp.json.dataSets?.[0];
  const seriesKeys = ds ? Object.keys(ds.series ?? {}) : [];
  console.log(`     dataSets[0].series keys: ${seriesKeys.slice(0,5).join(", ")}`);
  if (seriesKeys[0]) {
    const s = ds.series[seriesKeys[0]];
    const obsKeys = Object.keys(s.observations ?? {});
    console.log(`     observations keys: ${obsKeys.join(", ")}`);
    console.log(`     last obs: ${JSON.stringify(s.observations[obsKeys.at(-1)])}`);
  }
  // Also show structure periods
  const periods = hicp.json.structure?.dimensions?.observation?.[0]?.values;
  if (periods) console.log(`     periods: ${JSON.stringify(periods.slice(-3))}`);
}
await sleep(400);

// ── ECB: find correct interest rate series ────────────────────────────────────
console.log("\n── ECB interest rate series discovery ───────────────────────");
// Try the exact series IDs from ECB stat website
const ecbRates = [
  ["FM/B.U2.EUR.RT0.BB.1000.WT.CUR.MRR_MBR", "Main Refi Rate (MBR suffix)"],
  ["FM/B.U2.EUR.RT0.BB.1000.WT.CUR.MLF_RT",  "Marginal Lending"],
  ["FM/B.U2.EUR.RT0.BB.1000.WT.CUR.DFR",     "Deposit Facility (DFR original)"],
  ["FM/B.U2.EUR.RT.BB.1000.WT.CUR.DFR",      "Deposit Facility (no RT0)"],
  // Try different dataset key
  ["FM/D.U2.EUR.RT0.BB.1000.WT.CUR.DFR",     "Deposit Facility (Daily freq D)"],
];
for (const [path, label] of ecbRates) {
  await get(`https://data-api.ecb.europa.eu/service/data/${path}?lastNObservations=2&format=jsondata`, `ECB ${label}`);
  await sleep(300);
}

// ── ECB GDP: find correct MNA key ─────────────────────────────────────────────
console.log("\n── ECB GDP QoQ series discovery ─────────────────────────────");
const gdpPaths = [
  "MNA/Q.N.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY",
  "MNA/Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY",
  "MNA/Q.N.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.N_ACT",
  "MNA/Q.N.I9.W0.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY",
];
for (const path of gdpPaths) {
  const r = await get(`https://data-api.ecb.europa.eu/service/data/${path}?lastNObservations=2&format=jsondata`, path);
  await sleep(300);
}

// ── OECD: discover working dataflow IDs ──────────────────────────────────────
console.log("\n── OECD SDMX: discover dataflows ────────────────────────────");
// Try OECD stat's actual REST API
const oecdPaths = [
  // Different version of CLI
  ["https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI,2.0/USA.LI.M?lastNObservations=2&format=jsondata", "CLI v2.0"],
  ["https://sdmx.oecd.org/public/rest/data/DSD_STES@DF_CLI/USA.LI.M?lastNObservations=2&format=jsondata", "CLI no agency"],
  // OECD.Stat (older API endpoint)
  ["https://stats.oecd.org/sdmx-json/data/DP_LIVE/USA.CLI.LOLITOAA.IDX2015.M/OECD?lastNObservations=2", "OECD.Stat CLI"],
  ["https://stats.oecd.org/sdmx-json/data/DP_LIVE/USA.CPI.TOT.AGRWTH.M/OECD?lastNObservations=2", "OECD.Stat CPI"],
  // OECD data explorer API
  ["https://sdmx.oecd.org/public/rest/dataflow/OECD.SDD.STES?format=jsondata", "OECD SDD.STES dataflows"],
];
for (const [url, label] of oecdPaths) {
  await get(url, label);
  await sleep(500);
}

console.log();
