/**
 * Valuation helpers for MarketLens.
 *
 * Fetches quoteSummary (summaryDetail) from Yahoo Finance for key index ETFs
 * and classifies them into a three-state badge: CHEAP | FAIR | RICH.
 *
 * Thresholds are calibrated to long-run P/E history for each asset class.
 * They are intentionally wide — the badge is a directional signal, not a call.
 */
import { default as YF } from "yahoo-finance2";

const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

// ── Badge type ────────────────────────────────────────────────────────────────

export type ValuationState = "cheap" | "fair" | "rich" | "unavailable";

export interface ValuationEntry {
  ticker: string;
  label: string;
  assetClass: string;
  trailingPE: number | null;
  distributionYield: number | null; // decimal (e.g. 0.0103 = 1.03%)
  badge: ValuationState;
  badgeMetric: "pe" | "yield" | "none";
  note?: string;
}

// ── P/E thresholds by asset class ─────────────────────────────────────────────
// cheap < low threshold ≤ fair ≤ high threshold < rich

const PE_THRESHOLDS: Record<string, { cheap: number; rich: number }> = {
  "us-large":    { cheap: 18, rich: 27 }, // SPY — S&P 500 long-run avg ~16, post-GFC norm ~18-25
  "us-tech":     { cheap: 25, rich: 38 }, // QQQ — structural premium for growth
  "us-small":    { cheap: 14, rich: 22 }, // IWM — Russell 2000 tends to trade below large cap
  "intl-dm":     { cheap: 13, rich: 20 }, // EFA — international DM historically cheaper than US
  "em":          { cheap: 12, rich: 18 }, // EEM — EM historically trades at discount
};

function peState(assetClass: string, pe: number): ValuationState {
  const t = PE_THRESHOLDS[assetClass];
  if (!t) return "fair";
  if (pe < t.cheap) return "cheap";
  if (pe > t.rich)  return "rich";
  return "fair";
}

// ── Registry ──────────────────────────────────────────────────────────────────

const VALUATION_TICKERS: {
  ticker: string;
  label: string;
  assetClass: string;
  proxyFor: string;
}[] = [
  { ticker: "SPY",  label: "S&P 500 (SPY)",           assetClass: "us-large", proxyFor: "^GSPC" },
  { ticker: "QQQ",  label: "Nasdaq 100 (QQQ)",         assetClass: "us-tech",  proxyFor: "^NDX"  },
  { ticker: "IWM",  label: "Russell 2000 (IWM)",       assetClass: "us-small", proxyFor: "^RUT"  },
  { ticker: "EFA",  label: "Intl Developed (EFA)",     assetClass: "intl-dm",  proxyFor: "^STOXX50E" },
  { ticker: "EEM",  label: "Emerging Markets (EEM)",   assetClass: "em",       proxyFor: "EEM"   },
];

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchValuations(): Promise<ValuationEntry[]> {
  const entries: ValuationEntry[] = [];

  for (const def of VALUATION_TICKERS) {
    try {
      const r = await yf.quoteSummary(def.ticker, {
        modules: ["summaryDetail"],
      });
      const sd = r.summaryDetail ?? {};
      const pe: number | null = (sd as Record<string, unknown>).trailingPE as number ?? null;
      const yld: number | null = (sd as Record<string, unknown>).yield as number ?? null;

      let badge: ValuationState = "unavailable";
      let badgeMetric: ValuationEntry["badgeMetric"] = "none";

      if (pe != null) {
        badge = peState(def.assetClass, pe);
        badgeMetric = "pe";
      }

      entries.push({
        ticker: def.ticker,
        label: def.label,
        assetClass: def.assetClass,
        trailingPE: pe,
        distributionYield: yld,
        badge,
        badgeMetric,
      });
    } catch {
      entries.push({
        ticker: def.ticker,
        label: def.label,
        assetClass: def.assetClass,
        trailingPE: null,
        distributionYield: null,
        badge: "unavailable",
        badgeMetric: "none",
        note: "quoteSummary fetch failed",
      });
    }
  }

  return entries;
}

// ── Credit ETF yields (for fixed-income route) ────────────────────────────────

export const CREDIT_YIELD_TICKERS = ["LQD", "HYG", "EMB", "EMLC"] as const;
export type CreditTicker = typeof CREDIT_YIELD_TICKERS[number];

export async function fetchCreditYields(): Promise<Record<CreditTicker, number | null>> {
  const result = {} as Record<CreditTicker, number | null>;

  for (const ticker of CREDIT_YIELD_TICKERS) {
    try {
      const r = await yf.quoteSummary(ticker, { modules: ["summaryDetail"] });
      const yld = (r.summaryDetail as Record<string, unknown>)?.yield;
      result[ticker] = typeof yld === "number" ? yld : null;
    } catch {
      result[ticker] = null;
    }
  }

  return result;
}
