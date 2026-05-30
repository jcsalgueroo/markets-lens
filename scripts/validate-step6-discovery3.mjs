/**
 * Step 6 — Discovery round 3: pinpoint ECB rates key + OECD fallback
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
    if (ok && json) {
      const ds = json.dataSets?.[0];
      const sk = ds ? Object.keys(ds.series ?? {})[0] : null;
      if (sk) {
        const obsKeys = Object.keys(ds.series[sk].observations ?? {});
        const last = ds.series[sk].observations[obsKeys.at(-1)];
        const periods = json.structure?.dimensions?.observation?.[0]?.values ?? [];
        const lastP = periods.at(-1)?.id ?? "?";
        console.log(`  ✅ [${res.status}] ${label}  →  ${lastP} = ${last?.[0]}`);
      } else console.log(`  ✅ [${res.status}] ${label}  (no series key found)  ${text.slice(0,120)}`);
    } else {
      console.log(`  ❌ [${res.status}] ${label}  ${text.slice(0,120).replace(/\n/g," ")}`);
    }
    return { ok, json };
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message.slice(0,80)}`);
    return { ok: false };
  }
}

// ── ECB: try the catalog to find FM key format ────────────────────────────────
console.log("\n── ECB FM dataset catalog ───────────────────────────────────");
// Get the contentconstraint for FM to understand dimension structure
await get("https://data-api.ecb.europa.eu/service/dataflow/ECB/FM?format=jsondata", "ECB FM dataflow");
await sleep(400);

// Try with explicit ECB agency prefix
await get("https://data-api.ecb.europa.eu/service/data/ECB,FM,1.0/B.U2.EUR.RT0.BB.1000.WT.CUR.DFR?lastNObservations=2&format=jsondata", "ECB FM with agency+version");
await sleep(400);

// Try the BSI ECB dataset for monetary rates
await get("https://data-api.ecb.europa.eu/service/data/BSP/M.U2.EUR.RT0.BB.1000.WT.CUR.DFR?lastNObservations=2&format=jsondata", "BSP dataset");
await sleep(400);

// The ECB Key Interest Rates are often in dataset "FM" but with slightly different key
// Let's try fetching a range to find what exists
await get("https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.BB.1000.WT.CUR?lastNObservations=2&format=jsondata", "FM partial key (all variations)");
await sleep(400);

// ── ECB: try getting ECB rates from a different dataset ───────────────────────
// The ECB posts its policy rates as a press release series too
console.log("\n── ECB rates via Eurostat ───────────────────────────────────");
await get("https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/irt_ecb_all?lastNObservations=3&format=JSON", "Eurostat ECB rates (irt_ecb_all)");
await sleep(400);

// ── OECD fallback: try the OECD data explorer REST API ───────────────────────
console.log("\n── OECD data.oecd.org REST API ──────────────────────────────");
const oecdNew = [
  ["https://data.oecd.org/api/v1/data/CLI?locations=USA&indicators=LI&frequency=M&startPeriod=2024-01&format=jsondata", "CLI USA (data.oecd.org)"],
  ["https://data.oecd.org/api/v1/data/CPI?locations=DEU+FRA+GBR+JPN+KOR&indicators=TOT&frequency=M&startPeriod=2024-01&format=jsondata", "CPI multi-country"],
];
for (const [url, label] of oecdNew) {
  await get(url, label);
  await sleep(500);
}

// ── FRED as OECD data source ──────────────────────────────────────────────────
// FRED hosts many OECD-sourced series. Use these as the OECD replacement.
console.log("\n── FRED as OECD data fallback (public CSV) ──────────────────");
const fredOecd = [
  // CPI YoY for developed markets (OECD via FRED)
  ["JPNCPALTT01IXOBSAM", "Japan CPI YoY (OECD/FRED)"],
  ["KORCPALTT01IXOBSAM", "Korea CPI YoY (OECD/FRED)"],
  ["AUSCPALTT01IXOBSAM", "Australia CPI YoY"],
  ["GBRCPALTT01IXOBSAM", "UK CPI YoY"],
  ["DEUCPALTT01IXOBSAM", "Germany CPI YoY"],
  ["FRACPALTT01IXOBSAM", "France CPI YoY"],
  // CLI via OECD/FRED
  ["USALOLITONOSTSAM", "USA CLI (FRED/OECD)"],
  ["CHNLOLITONOSTSAM", "China CLI (FRED/OECD)"],
  ["JPNLOLITONOSTSAM", "Japan CLI (FRED/OECD)"],
  ["KORLOLITONOSTSAM", "Korea CLI (FRED/OECD)"],
  ["BRALOLITONOSTSAM", "Brazil CLI (FRED/OECD)"],
  ["MEXLOLITONOSTSAM", "Mexico CLI (FRED/OECD)"],
  ["COLLOLITONOSTSAM", "Colombia CLI (FRED/OECD)"],
  ["OECLOLITONOSTSAM", "OECD Total CLI (FRED)"],
];

for (const [id, label] of fredOecd) {
  try {
    const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    const lines = text.trim().split("\n").filter(l => !l.startsWith("DATE") && !l.includes("."));
    const last = lines.at(-1);
    if (res.ok && lines.length > 5) console.log(`  ✅ ${id.padEnd(24)} ${label}  →  last: ${last}  (${lines.length} obs)`);
    else console.log(`  ❌ ${id.padEnd(24)} ${label}  HTTP ${res.status} or sparse`);
  } catch (e) { console.log(`  ❌ ${id}: ${e.message.slice(0,40)}`); }
  await sleep(200);
}

console.log();
