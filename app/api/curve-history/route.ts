import { NextResponse } from "next/server";
import { blobReadCurveHistory } from "@/lib/blob";

// force-dynamic: reads directly from Vercel Blob on every request so charts
// always see the latest curve history without stale CDN responses.
export const dynamic = "force-dynamic";

export async function GET() {
  const blob = await blobReadCurveHistory();

  if (!blob) {
    return NextResponse.json(
      { error: "Yield curve history not yet available. Run the daily cron first." },
      { status: 404 }
    );
  }

  return NextResponse.json(blob, {
    headers: {
      // Browser-level: 15 min cache is fine — curves don't change intra-day
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
