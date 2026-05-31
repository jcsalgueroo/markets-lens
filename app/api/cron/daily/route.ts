import { NextRequest, NextResponse } from "next/server";
import { kvSet, kvSetTimestamp } from "@/lib/kv";
import { blobWriteHistory, blobWriteCurveHistory, HistorySeries } from "@/lib/blob";

// ── Auth ──────────────────────────────────────────────────────────────────────

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

// ── Internal fetch ────────────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<unknown> {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const res = await fetch(`${protocol}://${host}${url}`, {
    signal: AbortSignal.timeout(55_000),
    // Bypass Vercel's CDN / ISR cache so the cron always gets a fresh
    // response from each API route, even for routes with revalidate = 3600.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// ── History extractors ────────────────────────────────────────────────────────

type HistoryPoint = { date: string; value: number };

function toSeries(arr: unknown): HistoryPoint[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((p): p is { date: string; value: number } =>
      p && typeof p.date === "string" && typeof p.value === "number"
    );
}

// Fixed-income: treasuries have {date, yield} shape; normalise to {date, value}
function extractFixedIncomeHistory(data: unknown): HistorySeries {
  const d = data as Record<string, unknown>;
  const series: HistorySeries = {};

  // Yahoo Finance treasury history (4 tickers: ^IRX, ^FVX, ^TNX, ^TYX)
  const treasuries = (d.treasuries as unknown[]) ?? [];
  for (const t of treasuries) {
    const entry = t as { ticker: string; history?: { date: string; yield: number }[] };
    if (entry.ticker && Array.isArray(entry.history)) {
      series[entry.ticker] = entry.history.map((p) => ({ date: p.date, value: p.yield }));
    }
  }

  // FRED treasury history — use for all tenors (FRED DGS is the authoritative
  // daily source; Yahoo Finance ^IRX/^FVX/^TNX/^TYX sometimes has data gaps).
  // Store under the original Yahoo ticker keys for chart series-ID compatibility.
  const fredTenors = (d.fredTenors as Record<string, { yield: number | null; history: { date: string; yield: number }[] }>) ?? {};

  // 2Y: always from FRED DGS2 (no Yahoo equivalent), keyed "DGS2"
  const dgs2History = fredTenors["2Y"]?.history ?? [];
  if (dgs2History.length > 0) {
    series["DGS2"] = dgs2History.map((p) => ({ date: p.date, value: p.yield }));
  }

  // 3M/5Y/10Y/30Y: FRED history overrides Yahoo when available
  const fredOverrides: Record<string, string> = {
    "3M": "^IRX", "5Y": "^FVX", "10Y": "^TNX", "30Y": "^TYX",
  };
  for (const [tenor, yahooKey] of Object.entries(fredOverrides)) {
    const hist = fredTenors[tenor]?.history ?? [];
    if (hist.length > 0) {
      series[yahooKey] = hist.map((p) => ({ date: p.date, value: p.yield }));
    }
    // else: Yahoo Finance history already stored above — keep it as fallback
  }

  // FRED OAS credit spreads — stored in oasData.hyOas.history / igOas.history
  type OasHistPoint = { date: string; value: number };
  const oasData = (d.oasData as Record<string, { value: number | null; history: OasHistPoint[] }>) ?? {};
  const hyHistory = oasData.hyOas?.history ?? [];
  const igHistory = oasData.igOas?.history ?? [];
  if (hyHistory.length > 0) series["HY_OAS"] = toSeries(hyHistory);
  if (igHistory.length > 0) series["IG_OAS"] = toSeries(igHistory);

  // Credit ETF price history (weekly)
  const creditEtfs = (d.creditEtfs as unknown[]) ?? [];
  for (const c of creditEtfs) {
    const entry = c as { ticker: string; history?: { date: string; price: number }[] };
    if (entry.ticker && Array.isArray(entry.history)) {
      series[entry.ticker] = entry.history.map((p) => ({ date: p.date, value: p.price }));
    }
  }
  return series;
}

function extractCommodityHistory(data: unknown): HistorySeries {
  const d = data as Record<string, unknown>;
  const series: HistorySeries = {};
  for (const group of ["energy", "metals", "agriculture"] as const) {
    const items = (d[group] as unknown[]) ?? [];
    for (const item of items) {
      const entry = item as { ticker: string; history?: HistoryPoint[] };
      if (entry.ticker && Array.isArray(entry.history)) {
        series[entry.ticker] = toSeries(entry.history);
      }
    }
  }
  return series;
}

// Colombia route stores rate histories as { date, rate } (not { date, value }).
// Remap before passing to toSeries so the shape matches HistoryPoint.
function rateToValue(arr: unknown): HistoryPoint[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((p): p is { date: string; rate?: number; value?: number } =>
      p && typeof p.date === "string" && (typeof p.value === "number" || typeof p.rate === "number")
    )
    .map((p) => ({ date: p.date, value: (p.value ?? p.rate)! }));
}

function extractColombiaHistory(data: unknown): HistorySeries {
  const d = data as Record<string, unknown>;
  return {
    "USDCOP": rateToValue((d.trm as Record<string, unknown>)?.history),
    "TES10Y": rateToValue((d.tes10y as Record<string, unknown>)?.history),
    "IBR":    rateToValue((d.ibrRate as Record<string, unknown>)?.history),
    "OilCOP": toSeries((d.oilInCop as Record<string, unknown>)?.history),
  };
}

function extractGlobalHistory(data: unknown): HistorySeries {
  const d = data as Record<string, unknown>;
  const us  = (d.usMacro as Record<string, unknown>) ?? {};
  const eur = (d.eurArea as Record<string, unknown>) ?? {};
  const dxy = (d.dxy    as Record<string, unknown>) ?? {};

  const series: HistorySeries = {
    "DXY":        toSeries(dxy.history),
    "CPI":        toSeries((us.cpi         as Record<string, unknown>)?.history),
    "CorePCE":    toSeries((us.corePce     as Record<string, unknown>)?.history),
    "GDP":        toSeries((us.gdp         as Record<string, unknown>)?.history),
    "UNRATE":     toSeries((us.unemployment as Record<string, unknown>)?.history),
    "FEDFUNDS":   toSeries((us.fedFundsRate as Record<string, unknown>)?.history),
    "T10YIE":     toSeries((us.breakeven10y as Record<string, unknown>)?.history),
    "DFII10":     toSeries((us.realYield10y as Record<string, unknown>)?.history),
    "CAPE":       toSeries((us.shillerCape  as Record<string, unknown>)?.history),
    "ECB_HICP":   toSeries((eur.hicp        as Record<string, unknown>)?.history),
    "ECB_GDP":    toSeries((eur.gdp         as Record<string, unknown>)?.history),
    "ECB_DFR":    toSeries((eur.depositRate as Record<string, unknown>)?.history),
    "ECB_MRRFR":  toSeries((eur.mainRefiRate as Record<string, unknown>)?.history),
  };

  // ── OECD Composite Leading Indicators ──────────────────────────────────────
  // The CLI array contains one entry per country with its full history.
  // Extract each country as CLI_{COUNTRY_CODE} so chart components can
  // select any subset without pulling the whole blob.
  const oecd = (d.oecd as Record<string, unknown>) ?? {};
  const cliArr = (oecd.cli as Array<Record<string, unknown>>) ?? [];
  for (const entry of cliArr) {
    const country = String(entry.country ?? "");
    if (country) {
      series[`CLI_${country}`] = toSeries(entry.history);
    }
  }

  return series;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, "ok" | string> = {};

  // ── Step 1: fetch all datasets and write KV snapshots ──────────────────────
  const datasets: [Parameters<typeof kvSet>[0], string][] = [
    ["snapshot:equities",       "/api/equities"],
    ["snapshot:fixed-income",   "/api/fixed-income"],
    ["snapshot:commodities",    "/api/commodities"],
    ["snapshot:macro:colombia", "/api/macro/colombia"],
    ["snapshot:macro:global",   "/api/macro/global"],
    ["snapshot:valuation",      "/api/valuation"],
  ];

  const fetched: Record<string, unknown> = {};

  for (const [kvKey, apiPath] of datasets) {
    try {
      const data = await fetchJson(apiPath);
      await kvSet(kvKey, data);
      fetched[apiPath] = data;
      results[`kv:${kvKey}`] = "ok";
    } catch (e: unknown) {
      results[`kv:${kvKey}`] = e instanceof Error ? e.message : String(e);
    }
  }

  await kvSetTimestamp();

  // ── Step 2: extract history and write Blob snapshots ──────────────────────
  const historyTasks: [Parameters<typeof blobWriteHistory>[0], () => HistorySeries][] = [
    ["fixed-income",   () => extractFixedIncomeHistory(fetched["/api/fixed-income"])],
    ["commodities",    () => extractCommodityHistory(fetched["/api/commodities"])],
    ["macro-colombia", () => extractColombiaHistory(fetched["/api/macro/colombia"])],
    ["macro-global",   () => extractGlobalHistory(fetched["/api/macro/global"])],
  ];

  for (const [dataset, extract] of historyTasks) {
    try {
      const series = extract();
      const nonEmpty = Object.values(series).some((s) => s.length > 0);
      if (nonEmpty) {
        await blobWriteHistory(dataset, series);
        results[`blob:${dataset}`] = "ok";
      } else {
        results[`blob:${dataset}`] = "skipped (no data)";
      }
    } catch (e: unknown) {
      results[`blob:${dataset}`] = e instanceof Error ? e.message : String(e);
    }
  }

  // ── Step 3: append today's yield curve to the curve history blob ─────────
  // This is a rolling append (up to 365 days) used by the YieldCurveChart to
  // render 1W ago / 1M ago / Dec 31 overlay lines.
  try {
    const fiRaw = fetched["/api/fixed-income"] as Record<string, unknown> | undefined;
    const yieldCurve = fiRaw?.yieldCurve as
      | Array<{ tenor: string; yield: number | null }>
      | undefined;
    if (yieldCurve && yieldCurve.length > 0) {
      const asOf   = fiRaw?.asOf as string | undefined;
      const date   = asOf ? asOf.split("T")[0] : new Date().toISOString().split("T")[0];
      await blobWriteCurveHistory({ date, curve: yieldCurve });
      results["blob:yield-curve"] = "ok";
    } else {
      results["blob:yield-curve"] = "skipped (no curve data)";
    }
  } catch (e: unknown) {
    results["blob:yield-curve"] = e instanceof Error ? e.message : String(e);
  }

  const allOk = Object.values(results).every(
    (v) => v === "ok" || v === "skipped (no data)"
  );

  console.log("\n══ Cron results ══════════════════════════════════════");
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${v === "ok" ? "✅" : v === "skipped (no data)" ? "⏭️" : "❌"} ${k}: ${v}`);
  }
  console.log(`  Overall: ${allOk ? "SUCCESS" : "PARTIAL FAILURE"}`);
  console.log("══════════════════════════════════════════════════════\n");

  return NextResponse.json(
    { success: allOk, results, ranAt: new Date().toISOString() },
    { status: allOk ? 200 : 207 }
  );
}
