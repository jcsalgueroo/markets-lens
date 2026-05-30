import { NextRequest, NextResponse } from "next/server";
import { kvSet, kvSetTimestamp } from "@/lib/kv";

// Vercel injects CRON_SECRET automatically for cron-triggered requests.
// Protect the endpoint so it cannot be triggered by arbitrary callers.
function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // refuse if secret is unconfigured
  return auth === `Bearer ${secret}`;
}

async function fetchJson(url: string): Promise<unknown> {
  // VERCEL_PROJECT_PRODUCTION_URL is always the stable production domain (no https://)
  // Fall back to VERCEL_URL (deployment-specific) then localhost for local dev
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const res = await fetch(`${protocol}://${host}${url}`, {
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, "ok" | string> = {};

  const datasets: [Parameters<typeof kvSet>[0], string][] = [
    ["snapshot:equities",       "/api/equities"],
    ["snapshot:fixed-income",   "/api/fixed-income"],
    ["snapshot:commodities",    "/api/commodities"],
    ["snapshot:macro:colombia", "/api/macro/colombia"],
    ["snapshot:macro:global",   "/api/macro/global"],
  ];

  // Fetch sequentially to avoid hammering external APIs concurrently.
  for (const [kvKey, apiPath] of datasets) {
    try {
      const data = await fetchJson(apiPath);
      await kvSet(kvKey, data);
      results[kvKey] = "ok";
    } catch (e: unknown) {
      results[kvKey] = e instanceof Error ? e.message : String(e);
    }
  }

  await kvSetTimestamp();

  const allOk = Object.values(results).every((v) => v === "ok");
  return NextResponse.json(
    { success: allOk, results, ranAt: new Date().toISOString() },
    { status: allOk ? 200 : 207 }
  );
}
