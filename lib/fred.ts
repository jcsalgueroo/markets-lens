/**
 * FRED helpers for MarketLens.
 *
 * When FRED_API_KEY is set (production / Vercel), uses the official
 * FRED JSON API at api.stlouisfed.org for higher rate limits and
 * reliability.  Falls back to the public CSV endpoint (no key needed)
 * for local development.
 *
 * Attribution requirement (FRED® API Terms of Use):
 *   "This product uses the FRED® API but is not endorsed or certified
 *    by the Federal Reserve Bank of St. Louis."
 *   Terms: https://fred.stlouisfed.org/docs/api/terms_of_use.html
 */

export type FredObservation = { date: string; value: number };

// ── JSON API (with key) ───────────────────────────────────────────────────────

interface FredApiObservation {
  date: string;
  value: string; // "." means missing
}

interface FredApiResponse {
  observations: FredApiObservation[];
  error_code?: number;
  error_message?: string;
}

async function fetchFredApi(seriesId: string): Promise<FredObservation[]> {
  const key = process.env.FRED_API_KEY!; // only called when key is set
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(key)}` +
    `&file_type=json` +
    `&sort_order=asc`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { "User-Agent": "MarketLens/1.0" },
  });
  if (!res.ok) throw new Error(`FRED API ${seriesId}: HTTP ${res.status}`);

  const json = (await res.json()) as FredApiResponse;
  if (json.error_code) {
    throw new Error(`FRED API ${seriesId}: ${json.error_message ?? json.error_code}`);
  }

  return (json.observations ?? [])
    .filter((o) => o.value !== "." && o.date)
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .filter((o) => !isNaN(o.value));
}

// ── CSV fallback (no key) ─────────────────────────────────────────────────────

async function fetchFredCsvRaw(seriesId: string): Promise<FredObservation[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "MarketLens/1.0" },
  });
  if (!res.ok) throw new Error(`FRED CSV ${seriesId}: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1); // skip header row
  return lines
    .map((l) => {
      const [date, val] = l.split(",");
      return { date: date?.trim() ?? "", value: parseFloat(val ?? "") };
    })
    .filter((o) => o.date && !isNaN(o.value));
}

// ── Public interface ──────────────────────────────────────────────────────────

/**
 * Fetch all observations for a FRED series, oldest → newest.
 * Uses the keyed JSON API when FRED_API_KEY is set; CSV otherwise.
 */
export async function fetchFredCsv(seriesId: string): Promise<FredObservation[]> {
  if (process.env.FRED_API_KEY) {
    return fetchFredApi(seriesId);
  }
  return fetchFredCsvRaw(seriesId);
}

/** Return the most recent observation from a FRED series, or null on error. */
export async function fetchFredLatest(
  seriesId: string,
  count = 1
): Promise<FredObservation | null> {
  try {
    const obs = await fetchFredCsv(seriesId);
    return obs.at(-count) ?? null;
  } catch {
    return null;
  }
}
