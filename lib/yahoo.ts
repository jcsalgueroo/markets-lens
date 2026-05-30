/**
 * Yahoo Finance v3 helpers for MarketLens.
 * Uses yahoo-finance2 v3 class instantiation + chart() API.
 * historical() is deprecated in v3 — all price history via chart().
 */
import { default as YF } from "yahoo-finance2";

const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

export type QuoteResult = {
  ticker: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  change1D: number | null;
  error?: string;
};

export type HistoricalResult = {
  ticker: string;
  dates: string[];
  closes: number[];
  /** True when Yahoo Finance has the ticker but only returns 1 bar of history. */
  limitedHistory?: boolean;
  error?: string;
};

/** Fetch current quote for a single ticker. */
export async function fetchQuote(ticker: string): Promise<QuoteResult> {
  try {
    const q = await yf.quote(ticker, {}, { validateResult: false }) as any;
    if (!q) return { ticker, name: ticker, price: null, previousClose: null, change1D: null, error: "No data" };
    return {
      ticker,
      name: q.shortName ?? q.longName ?? ticker,
      price: q.regularMarketPrice ?? null,
      previousClose: q.regularMarketPreviousClose ?? null,
      change1D:
        q.regularMarketPrice != null && q.regularMarketPreviousClose != null
          ? ((q.regularMarketPrice - q.regularMarketPreviousClose) / q.regularMarketPreviousClose) * 100
          : null,
    };
  } catch (err) {
    return { ticker, name: ticker, price: null, previousClose: null, change1D: null, error: String(err) };
  }
}

/**
 * Fetch historical daily closes going back `calendarDays` days.
 *
 * Falls back to quote() when chart() returns ≤1 bar (e.g. ^IPSA / Chile),
 * synthesising a single-point result and setting limitedHistory=true.
 * Callers should treat limitedHistory entries as current-price-only:
 * 1D return comes from quote, all multi-period returns will be null.
 */
export async function fetchHistorical(ticker: string, calendarDays: number): Promise<HistoricalResult> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - calendarDays);

  try {
    const result = await yf.chart(ticker, { period1: start, period2: end, interval: "1d" }) as any;
    const quotes: any[] = result?.quotes ?? [];
    const closes = quotes.map((r: any) => r.adjclose ?? r.close).filter((c: any) => c != null);
    const dates  = quotes.map((r: any) => new Date(r.date).toISOString().slice(0, 10));

    // Sufficient history — normal path
    if (closes.length > 5) {
      return { ticker, dates, closes };
    }

    // Yahoo has the ticker but no meaningful history — fall back to quote()
    const q = await fetchQuote(ticker);
    if (q.price == null) {
      return { ticker, dates: [], closes: [], error: "No price from quote fallback" };
    }
    // Build a synthetic two-point array so 1D return can be computed:
    //   [previousClose, currentPrice]
    const syntheticCloses = q.previousClose != null
      ? [q.previousClose, q.price]
      : [q.price];
    const today = new Date().toISOString().slice(0, 10);
    return {
      ticker,
      dates: syntheticCloses.length === 2 ? ["prev", today] : [today],
      closes: syntheticCloses,
      limitedHistory: true,
    };
  } catch (err) {
    return { ticker, dates: [], closes: [], error: String(err) };
  }
}

/**
 * Compute period return given historical closes.
 * calendarDaysBack: approximate calendar-day lookback (1W=7, 1M=30, etc.)
 * Returns null when the closes array is shorter than the requested window.
 */
export function computeReturn(closes: number[], calendarDaysBack: number): number | null {
  if (closes.length < 2) return null;
  const tradingDaysBack = Math.round(calendarDaysBack * 0.69);
  const idx = Math.max(0, closes.length - 1 - tradingDaysBack);
  // Don't return a meaningless "return" when we don't have enough history
  if (closes.length - 1 - tradingDaysBack < 0) return null;
  const base = closes[idx];
  const current = closes[closes.length - 1];
  if (!base || !current) return null;
  return ((current - base) / base) * 100;
}

/** YTD return from first close of the current calendar year. */
export function computeYTD(dates: string[], closes: number[]): number | null {
  const currentYear = new Date().getFullYear().toString();
  const ytdIdx = dates.findIndex((d) => d.startsWith(currentYear));
  if (ytdIdx === -1 || closes.length === 0) return null;
  const base = closes[ytdIdx];
  const current = closes[closes.length - 1];
  if (!base || !current) return null;
  return ((current - base) / base) * 100;
}

/** 200ms delay between ticker fetches to respect yahoo-finance rate limits. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
