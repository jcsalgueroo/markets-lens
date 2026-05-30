/**
 * Phase 1, Step 2 validation script
 * Run: node scripts/validate-international.mjs
 * Confirms all international index tickers return data from yahoo-finance2 v3.
 */
import { default as YF } from "yahoo-finance2";
const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const EUROPE = [
  { ticker: "^STOXX50E", label: "Euro Stoxx 50" },
  { ticker: "^STOXX",    label: "STOXX Europe 600" },
  { ticker: "^GDAXI",    label: "DAX (Germany)" },
  { ticker: "^FCHI",     label: "CAC 40 (France)" },
  { ticker: "^FTSE",     label: "FTSE 100 (UK)" },
  { ticker: "^IBEX",     label: "IBEX 35 (Spain)" },
  { ticker: "FTSEMIB.MI",label: "FTSE MIB (Italy)" },
];

const ASIA = [
  { ticker: "^N225",    label: "Nikkei 225 (Japan)" },
  { ticker: "^HSI",     label: "Hang Seng (Hong Kong)" },
  { ticker: "000300.SS",label: "CSI 300 (China A-shares)" },
  { ticker: "^KS11",    label: "KOSPI (South Korea)" },
  { ticker: "^NSEI",    label: "Nifty 50 (India)" },
  { ticker: "^AXJO",    label: "ASX 200 (Australia)" },
  { ticker: "^TWII",    label: "Taiwan Weighted Index" },
];

const EM = [
  { ticker: "^BVSP",   label: "Bovespa (Brazil)" },
  { ticker: "^MXX",    label: "IPC (Mexico)" },
  { ticker: "^COLCAP", label: "COLCAP (Colombia)" },
  { ticker: "^IPSA",   label: "IPSA (Chile)" },
  { ticker: "EEM",     label: "MSCI EM broad (ETF fallback)" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOne(ticker) {
  try {
    const q = await yf.quote(ticker, {}, { validateResult: false });
    const price = q?.regularMarketPrice ?? null;
    const change = q?.regularMarketChangePercent ?? null;
    const currency = q?.currency ?? "?";
    return { ticker, price, change1D: change, currency, status: price != null ? "ok" : "no_price", name: q?.shortName ?? "" };
  } catch (err) {
    return { ticker, price: null, change1D: null, currency: "?", status: "error", error: String(err).slice(0, 120) };
  }
}

async function validateGroup(name, tickers) {
  console.log(`\n── ${name} ${"─".repeat(Math.max(0, 50 - name.length - 3))}`);
  let ok = 0;
  const failed = [];
  for (const { ticker, label } of tickers) {
    const r = await fetchOne(ticker);
    if (r.status === "ok") ok++;
    else failed.push(ticker);
    const flag = r.status === "ok" ? "✅" : "❌";
    const chg = r.change1D != null ? `${r.change1D > 0 ? "+" : ""}${r.change1D.toFixed(2)}%` : "  n/a";
    const errNote = r.error ? `  ⚠ ${r.error.slice(0, 70)}` : "";
    console.log(
      `${flag} ${ticker.padEnd(14)} ${String(r.price != null ? r.price.toFixed(2) : "null").padStart(11)}  ${chg.padStart(8)}  [${r.currency}]  ${label}${errNote}`
    );
    await sleep(200);
  }
  console.log(`   → ${ok}/${tickers.length} OK${failed.length ? `  | Failed: ${failed.join(", ")}` : ""}`);
  return { ok, total: tickers.length, failed };
}

console.log("\n══════════════════════════════════════════════════════");
console.log("  MarketLens — Phase 1, Step 2 Validation");
console.log("  International equity index ticker check");
console.log("══════════════════════════════════════════════════════");

const results = [];
results.push(await validateGroup("Europe", EUROPE));
results.push(await validateGroup("Asia / Pacific", ASIA));
results.push(await validateGroup("Emerging Markets", EM));

const totalOk = results.reduce((s, r) => s + r.ok, 0);
const totalAll = results.reduce((s, r) => s + r.total, 0);
console.log(`\n── Grand total: ${totalOk}/${totalAll} tickers validated ──`);
if (totalOk === totalAll) {
  console.log("✅ ALL INTERNATIONAL TICKERS OK — safe to extend /api/equities\n");
} else {
  console.log("⚠️  Some tickers failed — note fallbacks needed above\n");
}
console.log("══════════════════════════════════════════════════════\n");
