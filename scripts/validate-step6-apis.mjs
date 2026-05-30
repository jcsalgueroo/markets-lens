/**
 * Step 6 pre-validation — probe FRED, ECB, and OECD APIs
 * Run: node scripts/validate-step6-apis.mjs
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Requires FRED_API_KEY in env; falls back to public CSV if absent
const FRED_KEY = process.env.FRED_API_KEY ?? "";

async function tryJson(url, label) {
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    const ok = res.ok && json !== null;
    const snippet = text.slice(0, 180).replace(/\n/g, " ");
    console.log(`  ${ok ? "✅" : "❌"} [${res.status}] ${label}`);
    if (ok && json) {
      // Show a few values if it looks like observation data
      const obs = json.observations ?? json?.dataSets?.[0]?.observations ?? json?.data?.dataSets?.[0]?.observations;
      if (Array.isArray(obs)) console.log(`     obs count=${obs.length}  latest: ${JSON.stringify(obs.at(-1)).slice(0,80)}`);
      else if (obs && typeof obs === "object") {
        const keys = Object.keys(obs); console.log(`     obs keys=${keys.length}  sample: ${JSON.stringify(obs[keys.at(-1)])?.slice(0,80)}`);
      } else console.log(`     ${snippet}`);
    } else if (!ok) console.log(`     ${snippet}`);
    return { ok, json, status: res.status };
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message.slice(0, 80)}`);
    return { ok: false };
  }
}

// ── FRED API ─────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════");
console.log(`  FRED API  (key ${FRED_KEY ? "present ✅" : "MISSING ❌ — set FRED_API_KEY env var"})`);
console.log("══════════════════════════════════════════════════════════════");

const fredBase = `https://api.stlouisfed.org/fred/series/observations`;
const fredSeries = [
  ["CPIAUCSL",  "US CPI YoY (monthly)"],
  ["PCEPILFE",  "Core PCE (monthly)"],
  ["FEDFUNDS",  "Fed Funds Rate (daily)"],
  ["T10YIE",    "10Y Breakeven Inflation (daily)"],
  ["DFII10",    "Real 10Y Yield (daily)"],
  ["UNRATE",    "US Unemployment (monthly)"],
  ["GDP",       "US GDP QoQ (quarterly)"],
  ["CAPE",      "Shiller CAPE (monthly)"],
];

for (const [id, label] of fredSeries) {
  const url = FRED_KEY
    ? `${fredBase}?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=3`
    : `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
  const r = await tryJson(url, `FRED ${id} — ${label}`);
  if (!FRED_KEY && r.ok === false) {
    // CSV fallback
    try {
      const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { signal: AbortSignal.timeout(8000) });
      const lines = (await res.text()).trim().split("\n");
      console.log(`     CSV fallback: last=${lines.at(-1)}  total=${lines.length - 1}`);
    } catch {}
  }
  await sleep(300);
}

// ── ECB API ───────────────────────────────────────────────────────────────────
console.log("\n── ECB Data Portal (no auth) ─────────────────────────────────");
const ecbBase = "https://data-api.ecb.europa.eu/service/data";
const ecbSeries = [
  [`${ecbBase}/ICP/M.U2.N.000000.4.ANR?lastNObservations=3&format=jsondata`,   "Eurozone HICP CPI YoY (monthly)"],
  [`${ecbBase}/FM/B.U2.EUR.RT0.BB.1000.WT.CUR.MRR_FR?lastNObservations=3&format=jsondata`, "ECB Main Refi Rate"],
  [`${ecbBase}/FM/B.U2.EUR.RT0.BB.1000.WT.CUR.DFR?lastNObservations=3&format=jsondata`,    "ECB Deposit Facility Rate"],
  [`${ecbBase}/MNA/Q.N.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY?lastNObservations=4&format=jsondata`, "Eurozone GDP QoQ"],
];

for (const [url, label] of ecbSeries) {
  await tryJson(url, `ECB — ${label}`);
  await sleep(300);
}

// ── OECD API ──────────────────────────────────────────────────────────────────
console.log("\n── OECD SDMX API (no auth) ───────────────────────────────────");
const oecdBase = "https://sdmx.oecd.org/public/rest";
const oecdSeries = [
  // CLI — Composite Leading Indicator
  [`${oecdBase}/data/OECD.SDD.STES,DSD_STES@DF_CLI,1.0/USA+G-20+OECDE+CHN+JPN+KOR+BRA+MEX+COL.LI.M?lastNObservations=3&format=jsondata`, "OECD CLI (key countries)"],
  // CPI by country
  [`${oecdBase}/data/OECD.SDD.STES,DSD_STES@DF_CPI,3.0/JPN+KOR+AUS+GBR+DEU+FRA.CPALTT01.GY.M?lastNObservations=3&format=jsondata`, "CPI YoY (JPN/KOR/AUS/GBR/DEU/FRA)"],
  // Unemployment
  [`${oecdBase}/data/OECD.SDD.STES,DSD_STES@DF_QNA_EXPENDITURE_GROWTH,1.0/USA.B1_GE.ST.Q?lastNObservations=4&format=jsondata`, "US GDP QoQ (OECD)"],
];

for (const [url, label] of oecdSeries) {
  await tryJson(url, `OECD — ${label}`);
  await sleep(500);
}

console.log("\n══════════════════════════════════════════════════════════════\n");
