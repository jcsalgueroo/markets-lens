/**
 * Step 5 — Part 3: find working sources for TES yields, BanRep rate, and DXY
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. Try ^DXY with validateResult:false ────────────────────────────────────
console.log("\n── ^DXY with validateResult:false ───────────────────────────");
try {
  const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 400);
  const r = await yf.chart("^DXY", { period1: start, period2: end, interval: "1d" },
    { validateResult: false });
  const closes = (r?.quotes ?? []).map(q => q.adjclose ?? q.close).filter(Boolean);
  console.log(`  ✅ ^DXY bars=${closes.length}  last=${closes.at(-1)?.toFixed(3)}`);
} catch (e) {
  console.log(`  ❌ ^DXY: ${e.message.slice(0, 80)}`);
}

// ── 2. FRED for Colombian 10Y yield ──────────────────────────────────────────
// We don't have FRED_API_KEY here, but let's check if the series exists
console.log("\n── FRED Colombian bond series (no key needed for metadata) ──");
const FRED_SERIES = [
  ["INTGSTCOM193N", "Colombia Govt Bond Yield (monthly)"],
  ["COLIRLTLT01STM", "Colombia Long-term IR (OECD, monthly)"],
  ["IR3TIB01COM156N", "Colombia 3M Interbank Rate"],
  ["COLIR3TIB01STM", "Colombia 3M rate"],
];
for (const [id, label] of FRED_SERIES) {
  try {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&vintage_date=2025-05-30`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    const lines = text.trim().split("\n");
    const last = lines.at(-1);
    console.log(`  ${res.ok ? "✅" : "❌"} ${id.padEnd(22)} ${label}`);
    if (res.ok && lines.length > 5) console.log(`     Latest: ${last}  (${lines.length - 1} obs)`);
  } catch (e) {
    console.log(`  ❌ ${id}: ${e.message.slice(0, 60)}`);
  }
  await sleep(300);
}

// ── 3. BanRep with browser-like headers ──────────────────────────────────────
console.log("\n── BanRep with browser headers ──────────────────────────────");
const browserHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/html, */*",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "Referer": "https://www.banrep.gov.co/",
  "Origin": "https://www.banrep.gov.co",
};

// BanRep has a known API for TRM via their "indicadores" endpoint
const banrepEndpoints = [
  // Newer BanRep statistics portal
  ["https://www.banrep.gov.co/es/estadisticas/trm", "TRM page"],
  // BanRep datosabiertos
  ["https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=5", "datos.gov.co TRM"],
  // Socrata open data (Colombia datos abiertos has BanRep TRM)
  ["https://www.datos.gov.co/resource/mcec-87by.json?$limit=5", "datos.gov.co TRM v2"],
  // BanRep reporting via SFC (Superfinanciera)
  ["https://www.superfinanciera.gov.co/descargas/institucional/pubFile1027835/trm.csv", "SFC TRM CSV"],
];

for (const [url, label] of banrepEndpoints) {
  try {
    const res = await fetch(url, { headers: browserHeaders, signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    const isBlocked = text.includes("Radware") || text.includes("Bot Manager");
    const isJson = text.trim().startsWith("[") || text.trim().startsWith("{");
    const snippet = text.slice(0, 150).replace(/\n/g, " ");
    const icon = res.ok && !isBlocked ? "✅" : (isBlocked ? "🚫" : "❌");
    console.log(`  ${icon} [${res.status}] ${label}`);
    if (!isBlocked && res.ok) console.log(`     ${snippet}`);
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message.slice(0, 60)}`);
  }
  await sleep(300);
}

// ── 4. OECD for Colombia policy rate / short-term rate ────────────────────────
console.log("\n── OECD for Colombia short-term rates ───────────────────────");
const oecdUrl = "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,1.0/COL.IR3TIB.M?lastNObservations=24&format=jsondata";
try {
  const res = await fetch(oecdUrl, { signal: AbortSignal.timeout(10000) });
  const json = await res.json();
  const obs = json?.data?.dataSets?.[0]?.observations ?? {};
  const keys = Object.keys(obs).slice(-3);
  console.log(`  ${res.ok ? "✅" : "❌"} OECD Colombia 3M IR  (${Object.keys(obs).length} obs)  latest: ${keys.map(k => obs[k][0]).join(", ")}`);
} catch (e) {
  console.log(`  ❌ OECD Colombia rate: ${e.message.slice(0, 60)}`);
}

console.log();
