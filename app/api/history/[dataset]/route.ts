import { NextRequest, NextResponse } from "next/server";
import { blobReadHistory, HistoryDataset } from "@/lib/blob";

const VALID_DATASETS = new Set<HistoryDataset>([
  "fixed-income",
  "commodities",
  "macro-colombia",
  "macro-global",
  "equities",
]);

export const revalidate = 3600; // 1 h CDN cache

export async function GET(
  _req: NextRequest,
  { params }: { params: { dataset: string } }
) {
  const dataset = params.dataset as HistoryDataset;

  if (!VALID_DATASETS.has(dataset)) {
    return NextResponse.json(
      { error: `Unknown dataset "${dataset}". Valid: ${[...VALID_DATASETS].join(", ")}` },
      { status: 400 }
    );
  }

  const blob = await blobReadHistory(dataset);

  if (!blob) {
    return NextResponse.json(
      { error: `History for "${dataset}" not yet available. Run the daily cron first.` },
      { status: 404 }
    );
  }

  return NextResponse.json(blob, {
    headers: {
      // Allow browsers and CDN to cache for 1 h; revalidate in background
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
