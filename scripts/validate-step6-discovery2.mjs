/**
 * Step 6 — Discovery round 2: ECB rates + OECD dataflows
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
    const ok = res.ok;
    console.log(`  ${ok ? "✅" : "❌"} [${res.status}] ${label}`);
    if (ok && json) {
      // Try to extract a value from SDMX-JSON
      const ds = json.dataSets?.[0];
      const seriesKey = ds ? Object.keys(ds.series ?? {})[0] : null;
      if (seriesKey) {
        const obsKeys = Object.keys(ds.series[seriesKey].observations ?? {});
        const lastObs = ds.series[seriesKey].observations[obsKeys.at(-1)];
        const periods = json.structure?.dimensions?.observation?.[0]?.values ?? [];
        const lastPeriod = periods.at(-1)?.id ?? "?";
        console.log(`     lastPeriod=${lastPeriod}  value=${lastObs?.[0]}`);
      } else {
        console.log(`     ${text.slice(0,200).replace(/\n/g," ")}`);
      }
    } else if (!ok) {
      console.log(`     ${text.slice(0,150).replace(/\n/g," ")}`);
    }
    return { ok, json };
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message.slice(0,80)}`);
    return { ok: false };
  }
}

// ── ECB rates: try correct FM key ─────────────────────────────────────────────
console.log("\n── ECB interest rates (correct FM key hunt) ─────────────────");
const ECB = "https://data-api.ecb.europa.eu/service/data";
// The FM dataset uses this dimension order: freq.area.currency.provider.instrument.maturity.type.businesscover.series_variation
// Key interest rates are published under the SFX (Key ECB interest rates) dataset too
const ecbRatePaths = [
  // Try SFX dataset which specifically contains ECB key rates
  "SFX/D.EUR.DFR",                    // Deposit facility rate daily
  "SFX/D.EUR.MROR_FR",                // Main refi rate (fixed)
  "SFX/D.EUR.MLF",                    // Marginal lending
  // Try via the KEY_ECB_RATES dataset
  "FM/B.U2.EUR.RT0.BB.1000.WT.CUR.DFR",
  "FM/M.U2.EUR.RT0.BB.1000.WT.CUR.DFR",   // monthly freq
  // Try via stats.ecb.europa.eu direct
];
for (const path of ecbRatePaths) {
  await get(`${ECB}/${path}?lastNObservations=2&format=jsondata`, path);
  await sleep(300);
}

// ── OECD: inspect dataflow list ───────────────────────────────────────────────
console.log("\n── OECD SDD.STES dataflow list (excerpt) ────────────────────");
try {
  const res = await fetch(
    "https://sdmx.oecd.org/public/rest/dataflow/OECD.SDD.STES?format=jsondata",
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) }
  );
  const json = await res.json();
  const flows = json?.Dataflow ?? json?.dataflows ?? json?.Dataflows ?? [];
  if (Array.isArray(flows)) {
    console.log(`  Found ${flows.length} dataflows:`);
    flows.slice(0, 20).forEach(f => console.log(`    ${f.id ?? f.Id}  —  ${(f.name?.en ?? f.Name?.en ?? "")?.slice(0,50)}`));
  } else {
    console.log(`  Shape: ${Object.keys(json ?? {}).join(", ")}`);
    console.log(`  ${JSON.stringify(json).slice(0,400)}`);
  }
} catch (e) { console.log(`  ❌ ${e.message}`); }
await sleep(500);

// ── OECD: try stats.oecd.org (older, more stable endpoint) ───────────────────
console.log("\n── OECD via stats.oecd.org (v1 API) ────────────────────────");
const oecdOldBase = "https://stats.oecd.org/sdmx-json/data";
const oecdOld = [
  [`${oecdOldBase}/DP_LIVE/USA.CLI.LOLITOAA.IDX2015.M/OECD?lastNObservations=3&dimensionAtObservation=allDimensions`, "CLI USA (DP_LIVE)"],
  [`${oecdOldBase}/DP_LIVE/DEU+FRA+GBR+JPN+KOR+USA+CHN+BRA+MEX+COL.CLI.LOLITOAA.IDX2015.M/OECD?lastNObservations=2&dimensionAtObservation=allDimensions`, "CLI multi-country"],
  [`${oecdOldBase}/DP_LIVE/USA.CPI.TOT.AGRWTH.M/OECD?lastNObservations=3&dimensionAtObservation=allDimensions`, "CPI USA YoY"],
  [`${oecdOldBase}/DP_LIVE/DEU+FRA+GBR+JPN+KOR+AUS.CPI.TOT.AGRWTH.M/OECD?lastNObservations=2&dimensionAtObservation=allDimensions`, "CPI developed countries"],
  [`${oecdOldBase}/DP_LIVE/USA+DEU+FRA+GBR+JPN+KOR+AUS.UNEMP.TOT.PC_LF.Q/OECD?lastNObservations=3&dimensionAtObservation=allDimensions`, "Unemployment"],
];
for (const [url, label] of oecdOld) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    const ok = res.ok;
    console.log(`  ${ok ? "✅" : "❌"} [${res.status}] ${label}`);
    if (ok) {
      // DP_LIVE shape: dataSets[0].observations as {key: [value, ...]}
      const obs = json.dataSets?.[0]?.observations ?? {};
      const keys = Object.keys(obs);
      console.log(`     obs count=${keys.length}  sample: ${keys.slice(0,2).map(k => `${k}=${obs[k][0]}`).join("  ")}`);
    } else {
      console.log(`     ${JSON.stringify(json).slice(0,100)}`);
    }
  } catch (e) { console.log(`  ❌ ${label}: ${e.message.slice(0,60)}`); }
  await sleep(400);
}

console.log();
