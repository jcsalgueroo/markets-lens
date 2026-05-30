/**
 * Colombia datos.gov.co (Socrata) helpers.
 * Used for official BanRep TRM data — this portal doesn't have Radware protection.
 */

const BASE = "https://www.datos.gov.co/resource";
const TRM_DATASET = "32sa-8pi3"; // BanRep official TRM (USD/COP daily)

export type TrmRow = {
  date: string;       // YYYY-MM-DD
  value: number;      // COP per USD
};

/**
 * Fetch TRM (official USD/COP fixing) from datos.gov.co.
 * Returns rows sorted oldest→newest. Default: last 800 rows (~3Y).
 */
export async function fetchTrmHistory(limit = 800): Promise<TrmRow[]> {
  const url =
    `${BASE}/${TRM_DATASET}.json` +
    `?$order=vigenciadesde+DESC&$limit=${limit}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`datos.gov.co TRM: HTTP ${res.status}`);
  const data: any[] = await res.json();
  return data
    .map((r) => ({
      date: r.vigenciadesde?.slice(0, 10) ?? "",
      value: parseFloat(r.valor ?? ""),
    }))
    .filter((r) => r.date && !isNaN(r.value))
    .reverse(); // oldest first
}

/** Return the latest official TRM fixing. */
export async function fetchTrmLatest(): Promise<TrmRow | null> {
  try {
    const rows = await fetchTrmHistory(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
