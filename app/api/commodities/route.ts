import { NextResponse } from "next/server";
import { fetchHistorical, computeReturn, computeYTD, sleep } from "@/lib/yahoo";

export const maxDuration = 60;

// ── Ticker registry ───────────────────────────────────────────────────────────

type CommodityDef = {
  ticker: string;
  label: string;
  group: "energy" | "metals" | "agriculture";
  unit: string;
  currency: string;
  // USX tickers (ZW=F, ZC=F) are quoted in US cents — divide by 100 for USD display
  centsPerUnit?: boolean;
  isEtf?: boolean;
};

const COMMODITIES: CommodityDef[] = [
  // Energy
  { ticker: "CL=F", label: "WTI Crude Oil",     group: "energy",       unit: "bbl",    currency: "USD" },
  { ticker: "BZ=F", label: "Brent Crude Oil",    group: "energy",       unit: "bbl",    currency: "USD" },
  { ticker: "NG=F", label: "Natural Gas",        group: "energy",       unit: "MMBtu",  currency: "USD" },
  // Metals
  { ticker: "GC=F", label: "Gold",               group: "metals",       unit: "troy oz", currency: "USD" },
  { ticker: "SI=F", label: "Silver",             group: "metals",       unit: "troy oz", currency: "USD" },
  { ticker: "HG=F", label: "Copper",             group: "metals",       unit: "lb",      currency: "USD" },
  // Agriculture
  { ticker: "ZW=F", label: "Wheat",              group: "agriculture",  unit: "bu",     currency: "USX", centsPerUnit: true },
  { ticker: "ZC=F", label: "Corn",               group: "agriculture",  unit: "bu",     currency: "USX", centsPerUnit: true },
  { ticker: "DBA",  label: "Agriculture (broad)", group: "agriculture", unit: "share",  currency: "USD", isEtf: true },
];

const HISTORY_DAYS = 400; // ~265 trading days + YTD buffer

// ── Return periods ────────────────────────────────────────────────────────────

type ReturnPeriods = {
  "1D": number | null;
  "1W": number | null;
  "1M": number | null;
  "3M": number | null;
  "6M": number | null;
  "YTD": number | null;
  "1Y": number | null;
};

function computePeriods(dates: string[], closes: number[]): ReturnPeriods {
  if (closes.length < 2) {
    return { "1D": null, "1W": null, "1M": null, "3M": null, "6M": null, "YTD": null, "1Y": null };
  }
  return {
    "1D":  ((closes.at(-1)! - closes.at(-2)!) / closes.at(-2)!) * 100,
    "1W":  computeReturn(closes, 7),
    "1M":  computeReturn(closes, 30),
    "3M":  computeReturn(closes, 90),
    "6M":  computeReturn(closes, 180),
    "YTD": computeYTD(dates, closes),
    "1Y":  computeReturn(closes, 365),
  };
}

// ── Commodity entry type ──────────────────────────────────────────────────────

type CommodityEntry = {
  ticker: string;
  label: string;
  group: string;
  unit: string;
  currency: string;
  /** Price as quoted by Yahoo (USX for grains — divide by 100 for USD display). */
  priceRaw: number | null;
  /** USD-normalised price (centsPerUnit tickers divided by 100). */
  priceUsd: number | null;
  returns: ReturnPeriods;
  /** Weekly-thinned USD price history for charts (every 5th bar). */
  history: { date: string; value: number }[];
  isEtf: boolean;
  dataStatus: "ok" | "error";
  error?: string;
};

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET() {
  const entries: CommodityEntry[] = [];

  for (const def of COMMODITIES) {
    const hist = await fetchHistorical(def.ticker, HISTORY_DAYS);

    if (hist.error || hist.closes.length === 0) {
      entries.push({
        ticker: def.ticker, label: def.label, group: def.group,
        unit: def.unit, currency: def.currency,
        priceRaw: null, priceUsd: null,
        returns: { "1D": null, "1W": null, "1M": null, "3M": null, "6M": null, "YTD": null, "1Y": null },
        history: [],
        isEtf: def.isEtf ?? false,
        dataStatus: "error", error: hist.error ?? "No data",
      });
    } else {
      const priceRaw = hist.closes.at(-1) ?? null;
      const priceUsd = priceRaw != null && def.centsPerUnit ? priceRaw / 100 : priceRaw;
      // Thin to weekly and normalise to USD
      const history = hist.dates
        .map((d, i) => ({
          date: d,
          value: def.centsPerUnit ? hist.closes[i] / 100 : hist.closes[i],
        }))
        .filter((_, i) => i % 5 === 0 || i === hist.closes.length - 1);
      entries.push({
        ticker: def.ticker, label: def.label, group: def.group,
        unit: def.unit, currency: def.currency,
        priceRaw,
        priceUsd,
        returns: computePeriods(hist.dates, hist.closes),
        history,
        isEtf: def.isEtf ?? false,
        dataStatus: "ok",
      });
    }
    await sleep(200);
  }

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const gold   = entries.find((e) => e.ticker === "GC=F");
  const copper = entries.find((e) => e.ticker === "HG=F");
  const brent  = entries.find((e) => e.ticker === "BZ=F");

  // Gold/Copper ratio: gold ($/troy oz) ÷ copper ($/lb)
  // Rising ratio = risk-off / growth concern; falling = reflation/growth optimism
  const goldCopperRatio =
    gold?.priceUsd != null && copper?.priceUsd != null
      ? gold.priceUsd / copper.priceUsd
      : null;

  // Oil in COP: requires USDCOP rate — populated in Step 5.
  // Expose brent USD price here so the colombia route can multiply by USDCOP.
  const brentUsd = brent?.priceUsd ?? null;

  // ── Group views ─────────────────────────────────────────────────────────────
  const byGroup = {
    energy:      entries.filter((e) => e.group === "energy"),
    metals:      entries.filter((e) => e.group === "metals"),
    agriculture: entries.filter((e) => e.group === "agriculture"),
  };

  // ── Server log ───────────────────────────────────────────────────────────────
  const okCount = entries.filter((e) => e.dataStatus === "ok").length;
  console.log("\n══ MarketLens /api/commodities ═══════════════════════════");
  for (const [grp, items] of Object.entries(byGroup)) {
    console.log(`  ${grp}:`);
    items.forEach((e) => {
      const flag = e.dataStatus === "ok" ? "✅" : "❌";
      const price = e.priceUsd != null ? `$${e.priceUsd.toFixed(3)}` : "null";
      const chg = e.returns["1D"] != null
        ? (e.returns["1D"] >= 0 ? "+" : "") + e.returns["1D"].toFixed(2) + "%"
        : "n/a";
      console.log(`    ${flag} ${e.ticker.padEnd(6)} ${price.padStart(10)}  ${chg.padStart(7)}  ${e.label}${e.currency === "USX" ? " [÷100→USD]" : ""}`);
    });
  }
  console.log(`  Gold/Copper ratio: ${goldCopperRatio?.toFixed(2) ?? "n/a"}`);
  console.log(`  Tickers OK: ${okCount}/${entries.length}`);
  console.log("══════════════════════════════════════════════════════════\n");

  return NextResponse.json({
    asOf: new Date().toISOString(),
    energy:      byGroup.energy,
    metals:      byGroup.metals,
    agriculture: byGroup.agriculture,
    derived: {
      goldCopperRatio,
      brentUsd,
      // oilInCop populated by /api/macro/colombia once USDCOP is fetched (Step 5)
      oilInCop: null,
    },
    _meta: {
      tickersOk: okCount,
      tickersTotal: entries.length,
      notes: [
        "ZW=F (Wheat) and ZC=F (Corn) quoted in USX (US cents/bushel) — priceUsd = priceRaw / 100",
        "DBA is an ETF proxy for broad agriculture — no clean futures index on Yahoo Finance (per spec)",
        "Gold/Copper ratio: gold($/oz) ÷ copper($/lb) — rising = risk-off signal",
        "oilInCop is null here; computed in /api/macro/colombia once USDCOP rate is fetched (Step 5)",
        "All futures are front-month continuous contracts",
      ],
    },
  });
}
