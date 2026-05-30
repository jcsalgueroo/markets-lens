/**
 * Step 6 — ECB + OECD API validation (no auth needed)
 * Run: node scripts/validate-step6-ecb-oecd.mjs
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractObs(json) {
  // SDMX-JSON v1 and v2 have different shapes
  const ds = json?.dataSets?.[0] ?? json?.data?.dataSets?.[0];
  if (!ds) return null;
  const obs = ds.observations ?? ds.series?.["0:0:0:0:0"]?.observations ?? ds.series?.["0:0:0:0"]?.observations;
  return obs;
}

function latestValues(json, n = 3) {
  const obs = extractObs(json);
  if (!obs) return null;
  const keys = Object.keys(obs).map(Number).sort((a,b) => a-b).slice(-n);
  return keys.map(k => obs[k]?.[0]);
}

// Also try to get the time periods
function latestPeriods(json, n = 3) {
  const struct = json?.structure ?? json?.data?.structure;
  const dims = struct?.dimensions?.observation ?? struct?.dimensions?.obsDimension;
  if (!dims?.[0]?.values) return null;
  const vals = dims[0].values;
  return vals.slice(-n).map(v => v.id ?? v.name);
}

async function probe(url, label) {
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }

    if (!res.ok || !json) {
      console.log(`  ❌ [${res.status}] ${label}`);
      console.log(`     ${text.slice(0, 120)}`);
      return null;
    }

    const values  = latestValues(json);
    const periods = latestPeriods(json);
    console.log(`  ✅ [${res.status}] ${label}`);
    if (periods && values) {
      for (let i = 0; i < Math.min(periods.length, values.length); i++) {
        console.log(`     ${periods[i]}  =  ${values[i]}`);
      }
    } else {
      console.log(`     (parsed OK — obs shape: ${JSON.stringify(Object.keys(extractObs(json) ?? {})).slice(0,80)})`);
    }
    return json;
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message.slice(0, 80)}`);
    return null;
  }
}

// ── ECB API ───────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════");
console.log("  ECB Data Portal — https://data-api.ecb.europa.eu/service/data");
console.log("══════════════════════════════════════════════════════════════\n");

const ECB = "https://data-api.ecb.europa.eu/service/data";

// Eurozone HICP (CPI YoY)
await probe(`${ECB}/ICP/M.U2.N.000000.4.ANR?lastNObservations=3&format=jsondata`, "Eurozone HICP CPI YoY");
await sleep(400);

// ECB Main Refinancing Rate
await probe(`${ECB}/FM/B.U2.EUR.RT0.BB.1000.WT.CUR.MRR_FR?lastNObservations=3&format=jsondata`, "ECB Main Refi Rate");
await sleep(400);

// ECB Deposit Facility Rate
await probe(`${ECB}/FM/B.U2.EUR.RT0.BB.1000.WT.CUR.DFR?lastNObservations=3&format=jsondata`, "ECB Deposit Facility Rate");
await sleep(400);

// Eurozone GDP QoQ growth
await probe(`${ECB}/MNA/Q.N.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY?lastNObservations=4&format=jsondata`, "Eurozone GDP QoQ");
await sleep(400);

// ── OECD API ──────────────────────────────────────────────────────────────────
console.log("\n── OECD SDMX API — https://sdmx.oecd.org/public/rest/data ───\n");

const OECD = "https://sdmx.oecd.org/public/rest/data";

// CLI — main focus countries per spec
await probe(
  `${OECD}/OECD.SDD.STES,DSD_STES@DF_CLI,1.0/USA+G-20+OECDE+CHN+JPN+KOR+BRA+MEX+COL.LI.M?lastNObservations=3&format=jsondata`,
  "OECD CLI (US+G20+EUZ+CHN+JPN+KOR+BRA+MEX+COL)"
);
await sleep(600);

// CPI by country
await probe(
  `${OECD}/OECD.SDD.STES,DSD_STES@DF_CPI,3.0/JPN+KOR+AUS+GBR+DEU+FRA.CPALTT01.GY.M?lastNObservations=3&format=jsondata`,
  "CPI YoY (JPN/KOR/AUS/GBR/DEU/FRA)"
);
await sleep(600);

// Unemployment
await probe(
  `${OECD}/OECD.SDD.STES,DSD_STES@DF_STLABOUR,4.0/JPN+KOR+AUS+GBR+DEU+FRA.LRHUTTTT.STSA.M?lastNObservations=3&format=jsondata`,
  "Unemployment rate (JPN/KOR/AUS/GBR/DEU/FRA)"
);
await sleep(600);

// OECD CLI for all available members (broader)
await probe(
  `${OECD}/OECD.SDD.STES,DSD_STES@DF_CLI,1.0/all.LI.M?lastNObservations=1&format=jsondata`,
  "OECD CLI — all members (latest)"
);
await sleep(600);

console.log("\n══════════════════════════════════════════════════════════════\n");
