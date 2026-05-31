/**
 * Display-only TypeScript interfaces for MarketLens.
 * These mirror the shapes stored in Upstash KV by the daily cron.
 */

// ── Equities ──────────────────────────────────────────────────────────────────

export interface EquityReturns {
  "1D": number | null;
  "1W": number | null;
  "1M": number | null;
  "YTD": number | null;
}

export interface EquityEntry {
  ticker: string;
  label: string;
  currency?: string;
  price: number | null;
  returns: EquityReturns;
  dataStatus: "ok" | "limited" | "error";
  isProxy?: boolean;
  limitedHistory?: boolean;
  relativeReturns?: EquityReturns | null;
}

export interface EquitiesSnapshot {
  asOf: string;
  usBroad: EquityEntry[];
  usSectors: EquityEntry[];
  usFactors: EquityEntry[];
  europe: EquityEntry[];
  asia: EquityEntry[];
  em: EquityEntry[];
}

// ── Fixed Income ──────────────────────────────────────────────────────────────

export interface FIReturns {
  "1D": number | null;
  "1W": number | null;
  "1M": number | null;
  "3M": number | null;
  "1Y": number | null;
  "YTD": number | null;
}

export interface TreasuryEntry {
  ticker: string;
  label: string;
  tenor: string;
  yieldLevel: number | null;
  returns: FIReturns;
  dataStatus: "ok" | "error";
}

export interface CreditEntry {
  ticker: string;
  label: string;
  price: number | null;
  impliedYield: number | null; // already in % (e.g. 5.82)
  returns: FIReturns;
  dataStatus: "ok" | "error";
}

export interface SpreadEntry {
  value: number | null;
  label: string;
  description: string;
}

export interface OasEntry {
  value: number | null;
  date: string | null;
  label: string;
  ticker: string;
}

export interface FixedIncomeSnapshot {
  asOf: string;
  treasuries: TreasuryEntry[];
  creditEtfs: CreditEntry[];
  spreads: SpreadEntry[];
  yieldCurve: { tenor: string; yield: number | null }[];
  oasData?: {
    hyOas: OasEntry;
    igOas: OasEntry;
    hyIgSpread: number | null;
  };
}

// ── Commodities ───────────────────────────────────────────────────────────────

export interface CommodityReturns {
  "1D": number | null;
  "1W": number | null;
  "1M": number | null;
  "3M": number | null;
  "6M": number | null;
  "1Y": number | null;
  "YTD": number | null;
}

export interface CommodityEntry {
  ticker: string;
  label: string;
  group: string;
  unit: string;
  currency: string;
  priceUsd: number | null;
  returns: CommodityReturns;
  dataStatus: "ok" | "error";
}

export interface CommoditiesSnapshot {
  asOf: string;
  energy: CommodityEntry[];
  metals: CommodityEntry[];
  agriculture: CommodityEntry[];
  derived: {
    goldCopperRatio: number | null;
    brentUsd: number | null;
    oilInCop: number | null;
  };
}

// ── Valuation ─────────────────────────────────────────────────────────────────

export type ValuationBadge = "cheap" | "fair" | "rich" | "unavailable";

export interface ValuationEntry {
  ticker: string;
  label: string;
  assetClass: string;
  trailingPE: number | null;
  distributionYield: number | null; // decimal (0.0103 = 1.03%)
  badge: ValuationBadge;
  badgeMetric: "pe" | "yield" | "none";
}

export interface CreditYieldEntry {
  yield: number | null; // decimal (0.0455 = 4.55%)
  label: string;
}

export interface ValuationSnapshot {
  asOf: string;
  equityValuations: ValuationEntry[];
  creditYields: {
    LQD: CreditYieldEntry;
    HYG: CreditYieldEntry;
    EMB: CreditYieldEntry;
    EMLC: CreditYieldEntry;
  };
  derived: {
    hyIgSpreadProxy: number | null; // decimal
    marketBadge: "cheap" | "fair" | "rich";
  };
}

// ── Colombia Macro ────────────────────────────────────────────────────────────

export interface ColombiaSnapshot {
  asOf: string;
  trm: {
    current: number | null;
    returns: FIReturns;
    officialFixing: { date: string; value: number } | null;
    status: "ok" | "stale" | "unavailable";
    officialStatus: "ok" | "stale" | "unavailable";
  };
  tes10y: {
    value: number | null;
    date: string | null;
    source: string;
    status: "ok" | "stale" | "unavailable" | "error";
    note?: string;
  };
  ibrRate: {
    value: number | null;
    date: string | null;
    source: string;
    status: "ok" | "stale" | "unavailable" | "error";
    note?: string;
  };
  oilInCop: {
    current: number | null;
    brentUsd: number | null;
  };
}

// ── Global Macro ──────────────────────────────────────────────────────────────

export interface MacroSeries {
  value: number | null;
  date: string | null;
  label: string;
  status: "ok" | "error" | "unavailable";
  frequency?: string;
}

export interface GlobalSnapshot {
  usMacro: {
    cpi: MacroSeries;
    corePce: MacroSeries;
    gdp: MacroSeries;
    unemployment: MacroSeries;
    fedFundsRate: MacroSeries;
    breakeven10y: MacroSeries;
    realYield10y: MacroSeries;
    shillerCape: MacroSeries;
  };
  dxy: {
    value: number | null;
    change1d: number | null;
    change1w: number | null;
    status: "ok" | "limited" | "error";
  };
  eurArea: {
    hicp: MacroSeries;
    gdp: MacroSeries;
    depositRate: MacroSeries;
    mainRefiRate: MacroSeries;
  };
  oecd?: {
    cli: Array<{
      country: string;
      label: string;
      value: number | null;
      date: string | null;
      status: "ok" | "unavailable";
    }>;
  };
  meta?: {
    fetchedAt?: string;
    fredKeyPresent?: boolean;
  };
}
