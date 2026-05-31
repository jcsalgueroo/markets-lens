import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET() {
  const key = process.env.FRED_API_KEY ?? "";

  const results: Record<string, unknown> = {
    fredKeyPresent: !!key,
    fredKeyLength: key.length,
    fredKeyFormatValid: /^[a-z0-9]{32}$/.test(key),
  };

  // Test FRED JSON API for CAPE
  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=CAPE` +
      `&api_key=${encodeURIComponent(key)}` +
      `&file_type=json` +
      `&sort_order=desc` +
      `&limit=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const raw = await res.text();
    results.fredApiStatus = res.status;
    results.fredApiBody = raw.slice(0, 500);
  } catch (e) {
    results.fredApiError = e instanceof Error ? e.message : String(e);
  }

  // Test FRED CSV fallback for CAPE
  try {
    const csvUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=CAPE`;
    const res = await fetch(csvUrl, { signal: AbortSignal.timeout(10_000) });
    const raw = await res.text();
    results.fredCsvStatus = res.status;
    results.fredCsvBody = raw.slice(0, 200);
  } catch (e) {
    results.fredCsvError = e instanceof Error ? e.message : String(e);
  }

  // Test Yale Shiller data
  try {
    const res = await fetch("http://www.econ.yale.edu/~shiller/data/ie_data.xls", {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "MarketLens/1.0" },
    });
    results.yaleStatus = res.status;
    results.yaleContentType = res.headers.get("content-type");
    results.yaleContentLength = res.headers.get("content-length");
  } catch (e) {
    results.yaleError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}
