import { NextRequest, NextResponse } from "next/server";
import { blobReadHistory, HistoryDataset } from "@/lib/blob";

const VALID_DATASETS = new Set<HistoryDataset>([
  "fixed-income",
  "commodities",
  "macro-colombia",
  "macro-global",
  "equities",
]);

// force-dynamic: every request reads fresh from Vercel Blob.
// Previously used revalidate=3600, but that caused Vercel's Edge CDN to
// cache 404 responses when the blob didn't exist yet, preventing charts
// from loading even after the cron successfully wrote the blob.
// The blob itself is already written once per day by the cron; reading it
// fresh on every chart load is cheap (one list() + one fetch).
export const dynamic = "force-dynamic";

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
      // Let browsers cache for 15 min; stale-while-revalidate allows
      // background refresh. Short TTL so chart data stays fresh across
      // the day without hammering the blob store on every keystroke.
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
