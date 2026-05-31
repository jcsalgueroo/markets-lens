/**
 * Vercel Blob helpers for MarketLens price history.
 *
 * Each dataset is stored as a single JSON file at a fixed path.
 * Blobs are public (readable by the frontend via direct URL).
 * Writing requires BLOB_READ_WRITE_TOKEN (set in Vercel env vars).
 */
import { put, list } from "@vercel/blob";

export type HistoryDataset =
  | "fixed-income"
  | "commodities"
  | "macro-colombia"
  | "macro-global"
  | "equities"; // populated by the weekly cron (Step 9)

/** One data point in a history series. */
export type HistoryPoint = { date: string; value: number };

/** A named collection of history series keyed by ticker / series ID. */
export type HistorySeries = Record<string, HistoryPoint[]>;

export interface HistoryBlob {
  dataset: HistoryDataset;
  updatedAt: string;
  series: HistorySeries;
}

// 1 200 points covers ~3 years of daily FRED/Yahoo data (750 trading days)
// plus ample buffer for gaps and weekend entries.  Monthly series (CAPE,
// CPI, etc.) will only have ~36 points for 3 Y anyway, so the cap never bites.
const MAX_POINTS = 1_200;

function trim(arr: HistoryPoint[]): HistoryPoint[] {
  return arr.slice(-MAX_POINTS);
}

/**
 * Write (or overwrite) a history blob for a dataset.
 * Each series is trimmed to MAX_POINTS before writing.
 */
export async function blobWriteHistory(
  dataset: HistoryDataset,
  series: HistorySeries
): Promise<string> {
  const payload: HistoryBlob = {
    dataset,
    updatedAt: new Date().toISOString(),
    series: Object.fromEntries(
      Object.entries(series).map(([k, v]) => [k, trim(v)])
    ),
  };
  const blob = await put(`history/${dataset}.json`, JSON.stringify(payload), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

/**
 * Read a history blob for a dataset.
 * Returns null if the blob doesn't exist yet or on any error.
 */
export async function blobReadHistory(
  dataset: HistoryDataset
): Promise<HistoryBlob | null> {
  try {
    const { blobs } = await list({
      prefix: `history/${dataset}.json`,
      limit: 1,
    });
    if (!blobs.length) return null;

    // Private-store blobs require authentication on every fetch.
    // `blobs[0].downloadUrl` is just `url?download=1` — it still needs
    // auth.  The correct server-side approach is to include the
    // BLOB_READ_WRITE_TOKEN in an Authorization: Bearer header.
    const res = await fetch(blobs[0].url, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN ?? ""}`,
      },
    });
    if (!res.ok) return null;
    return res.json() as Promise<HistoryBlob>;
  } catch {
    return null;
  }
}
