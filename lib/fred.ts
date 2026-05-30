/**
 * FRED helpers for MarketLens.
 * Uses the public CSV endpoint (no API key) for series that don't need
 * real-time freshness. For key FRED series (Step 6) the full API is used.
 */

export type FredObservation = { date: string; value: number };

/**
 * Fetch a FRED series via the public CSV endpoint (no API key required).
 * Returns observations sorted oldest→newest, dropping "." (missing) values.
 */
export async function fetchFredCsv(seriesId: string): Promise<FredObservation[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "MarketLens/1.0" },
  });
  if (!res.ok) throw new Error(`FRED CSV ${seriesId}: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1); // skip header
  return lines
    .map((l) => {
      const [date, val] = l.split(",");
      return { date: date?.trim(), value: parseFloat(val ?? "") };
    })
    .filter((o) => o.date && !isNaN(o.value));
}

/** Return the most recent N observations from a FRED series. */
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
