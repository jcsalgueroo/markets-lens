/**
 * Step 5 — Part 4: finalize working sources
 * 1. DX-Y.NYB as DXY replacement
 * 2. datos.gov.co deeper exploration (TRM history + policy rate + TES)
 * 3. FRED Colombia series via CSV (no key needed)
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. DXY alternatives on Yahoo Finance ─────────────────────────────────────
console.log("\n── DXY ticker alternatives ──────────────────────────────────");
for (const t of ["DX-Y.NYB", "DX=F", "UUP"]) {
  const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 400);
  try {
    const r = await yf.chart(t, { period1: start, period2: end, interval: "1d" },
      { validateResult: false });
    const closes = (r?.quotes ?? []).map(q => q.adjclose ?? q.close).filter(Boolean);
    const flag = closes.length > 20 ? "✅" : "❌";
    console.log(`  ${flag} ${t.padEnd(12)} bars=${closes.length}  last=${closes.at(-1)?.toFixed(3) ?? "null"}`);
  } catch (e) {
    console.log(`  ❌ ${t.padEnd(12)} ${e.message.slice(0, 60)}`);
  }
  await sleep(200);
}

// ── 2. datos.gov.co — TRM history depth ──────────────────────────────────────
console.log("\n── datos.gov.co TRM — history depth ─────────────────────────");
try {
  // Fetch last 3Y of TRM from Socrata, ordered by date
  const url = "https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde+DESC&$limit=800";
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  console.log(`  ✅ TRM rows returned: ${data.length}`);
  console.log(`  Newest: ${data[0]?.vigenciadesde?.slice(0,10)} = ${data[0]?.valor} COP`);
  console.log(`  Oldest: ${data.at(-1)?.vigenciadesde?.slice(0,10)} = ${data.at(-1)?.valor} COP`);
} catch (e) {
  console.log(`  ❌ ${e.message.slice(0, 80)}`);
}

// ── 3. datos.gov.co — search for BanRep policy rate ──────────────────────────
console.log("\n── datos.gov.co BanRep policy rate / TES yields ─────────────");
const datasets = [
  ["https://www.datos.gov.co/resource/hfac-7s4r.json?$limit=5", "BanRep tasa intervención (hfac-7s4r)"],
  ["https://www.datos.gov.co/resource/gxxe-ifua.json?$limit=5", "BanRep TES (gxxe-ifua)"],
  ["https://www.datos.gov.co/resource/3550-07kh.json?$limit=5", "BanRep indicadores (3550-07kh)"],
  ["https://www.datos.gov.co/resource/dqr3-qsgy.json?$limit=5", "TES curve (dqr3-qsgy)"],
  ["https://www.datos.gov.co/resource/p342-gryy.json?$limit=5", "BanRep rates (p342-gryy)"],
];
for (const [url, label] of datasets) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const isArr = Array.isArray(data);
    if (isArr && data.length > 0) {
      console.log(`  ✅ ${label}`);
      console.log(`     Keys: ${Object.keys(data[0]).slice(0,6).join(", ")}`);
      console.log(`     Sample: ${JSON.stringify(data[0]).slice(0, 120)}`);
    } else {
      console.log(`  ❌ ${label} — no rows`);
    }
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message.slice(0, 60)}`);
  }
  await sleep(300);
}

// ── 4. FRED Colombia series via public CSV (no API key) ───────────────────────
console.log("\n── FRED Colombia series (public CSV) ─────────────────────────");
const fredSeries = [
  ["COLIRLTLT01STM", "Colombia 10Y bond yield (OECD, monthly)"],
  ["COLIR3TIB01STM", "Colombia 3M interbank / IBR proxy (monthly)"],
];
for (const [id, label] of fredSeries) {
  try {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    const lines = text.trim().split("\n").filter(l => !l.startsWith("DATE") && l.includes(","));
    const last3 = lines.slice(-3);
    console.log(`  ✅ ${id} (${label}) — ${lines.length} obs`);
    last3.forEach(l => console.log(`     ${l}`));
  } catch (e) {
    console.log(`  ❌ ${id}: ${e.message.slice(0, 60)}`);
  }
  await sleep(300);
}

console.log();
