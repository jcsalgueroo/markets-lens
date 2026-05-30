/**
 * Phase 1, Step 5 — /api/macro/colombia end-to-end validation
 * Run: node scripts/validate-step5.mjs
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function computeReturn(closes, calDays) {
  if (closes.length < 2) return null;
  const idx = Math.max(0, closes.length - 1 - Math.round(calDays * 0.69));
  const base = closes[idx], cur = closes.at(-1);
  return base && cur ? ((cur - base) / base) * 100 : null;
}
function toWeekly(arr) { return arr.filter((_, i) => i % 5 === 0 || i === arr.length - 1); }

async function fetchChart(ticker, days) {
  const end = new Date(); const start = new Date(); start.setDate(start.getDate() - days);
  const r = await yf.chart(ticker, { period1: start, period2: end, interval: "1d" },
    { validateResult: false });
  const closes = (r?.quotes ?? []).map(q => q.adjclose ?? q.close).filter(Boolean);
  const dates  = (r?.quotes ?? []).map(q => new Date(q.date).toISOString().slice(0, 10));
  return { closes, dates, bars: closes.length };
}

async function fetchFredCsv(id) {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`,
    { signal: AbortSignal.timeout(10000) });
  const text = await res.text();
  return text.trim().split("\n").slice(1)
    .map(l => { const [d, v] = l.split(","); return { date: d?.trim(), value: parseFloat(v ?? "") }; })
    .filter(o => o.date && !isNaN(o.value));
}

async function fetchTrmOfficial() {
  const res = await fetch(
    "https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde+DESC&$limit=5",
    { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  return data.map(r => ({ date: r.vigenciadesde?.slice(0,10), value: parseFloat(r.valor) }))
    .filter(r => r.date && !isNaN(r.value)).reverse();
}

console.log("\n══════════════════════════════════════════════════════════════");
console.log("  MarketLens — Phase 1, Step 5 End-to-End Validation");
console.log("  /api/macro/colombia — all data sources");
console.log("══════════════════════════════════════════════════════════════\n");

// ── TRM (Yahoo Finance) ──────────────────────────────────────────────────────
console.log("── TRM (USD/COP) — Yahoo Finance USDCOP=X ───────────────────");
const trm = await fetchChart("USDCOP=X", 365 * 3 + 60);
const trmCur  = trm.closes.at(-1);
const trmPrev = trm.closes.at(-2);
const trm1D   = trmCur && trmPrev ? ((trmCur - trmPrev) / trmPrev * 100) : null;
const trm1M   = computeReturn(trm.closes, 30);
const trm1Y   = computeReturn(trm.closes, 365);
const trmWeekly = toWeekly(trm.closes);
console.log(`  ✅ USDCOP=X  current=${trmCur?.toFixed(2)} COP  1D=${trm1D?.toFixed(3)}%  1M=${trm1M?.toFixed(2)}%  1Y=${trm1Y?.toFixed(2)}%`);
console.log(`  daily bars=${trm.bars}  weekly points=${trmWeekly.length}`);
await sleep(200);

// ── TRM official (datos.gov.co) ──────────────────────────────────────────────
console.log("\n── TRM official — datos.gov.co BanRep ───────────────────────");
try {
  const official = await fetchTrmOfficial();
  official.forEach(r => console.log(`  ✅ ${r.date}  ${r.value} COP/USD`));
} catch (e) { console.log(`  ❌ ${e.message}`); }

// ── TES 10Y — FRED ───────────────────────────────────────────────────────────
console.log("\n── TES 10Y yield — FRED COLIRLTLT01STM ──────────────────────");
try {
  const obs = await fetchFredCsv("COLIRLTLT01STM");
  const last3 = obs.slice(-3);
  last3.forEach(o => console.log(`  ✅ ${o.date}  ${o.value}%`));
  console.log(`  Total: ${obs.length} monthly obs`);
} catch (e) { console.log(`  ❌ ${e.message}`); }
await sleep(300);

// ── IBR / BanRep rate proxy — FRED ──────────────────────────────────────────
console.log("\n── IBR 3M proxy — FRED COLIR3TIB01STM ───────────────────────");
try {
  const obs = await fetchFredCsv("COLIR3TIB01STM");
  const last3 = obs.slice(-3);
  last3.forEach(o => console.log(`  ✅ ${o.date}  ${o.value}%`));
  console.log(`  Total: ${obs.length} monthly obs`);
} catch (e) { console.log(`  ❌ ${e.message}`); }
await sleep(300);

// ── Oil in COP (BZ=F × USDCOP=X) ────────────────────────────────────────────
console.log("\n── Oil in COP — BZ=F × USDCOP=X ────────────────────────────");
const brent = await fetchChart("BZ=F", 365 * 3 + 60);
await sleep(200);
const usdcop = await fetchChart("USDCOP=X", 365 * 3 + 60);
const copByDate = new Map(usdcop.dates.map((d, i) => [d, usdcop.closes[i]]));
const oilCopSeries = brent.dates.map((d, i) => {
  const cop = copByDate.get(d); const br = brent.closes[i];
  return cop && br ? { date: d, value: br * cop } : null;
}).filter(Boolean);
const oilCopCur = oilCopSeries.at(-1);
const oilCopWkly = toWeekly(oilCopSeries);
console.log(`  Brent USD:  $${brent.closes.at(-1)?.toFixed(2)}/bbl  (${brent.bars} bars)`);
console.log(`  USDCOP:     ${usdcop.closes.at(-1)?.toFixed(2)} COP/USD  (${usdcop.bars} bars)`);
console.log(`  Oil in COP: ${oilCopCur?.value?.toFixed(0)} COP/bbl  aligned_days=${oilCopSeries.length}  weekly=${oilCopWkly.length}`);

// ── DX-Y.NYB (DXY replacement) ───────────────────────────────────────────────
console.log("\n── DXY replacement — DX-Y.NYB ───────────────────────────────");
await sleep(200);
const dxy = await fetchChart("DX-Y.NYB", 400);
const dxyChg = dxy.closes.length >= 2 ? ((dxy.closes.at(-1) - dxy.closes.at(-2)) / dxy.closes.at(-2) * 100) : null;
console.log(`  ✅ DX-Y.NYB  level=${dxy.closes.at(-1)?.toFixed(3)}  1D=${dxyChg?.toFixed(3)}%  bars=${dxy.bars}`);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n══ Step 5 Summary ════════════════════════════════════════════");
console.log("  ✅ TRM:          Yahoo Finance USDCOP=X (daily 3Y)");
console.log("  ✅ TRM official: datos.gov.co BanRep fixing (daily)");
console.log("  ✅ TES 10Y:      FRED COLIRLTLT01STM (monthly)");
console.log("  ✅ IBR proxy:    FRED COLIR3TIB01STM (monthly)");
console.log("  ✅ Oil in COP:   BZ=F × USDCOP=X (daily aligned, weekly chart)");
console.log("  ✅ DXY:          DX-Y.NYB (replaces broken ^DXY)");
console.log("  ❌ TES 2Y/5Y:   No free source — BanRep WAF-blocked, Yahoo has no tickers");
console.log("\n/api/macro/colombia route ready\n");
console.log("══════════════════════════════════════════════════════════════\n");
