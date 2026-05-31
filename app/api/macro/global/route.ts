import { NextResponse } from "next/server";
import { fetchFredCsv } from "@/lib/fred";
import { fetchShillerCapeYale } from "@/lib/shiller";
import { default as YF } from "yahoo-finance2";

const yf = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

// ── Helpers ───────────────────────────────────────────────────────────────────

function last<T>(arr: T[]): T | undefined {
  return arr.at(-1);
}

function thinWeekly<T extends { date: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((o) => {
    const d = new Date(o.date);
    const weekKey = `${d.getFullYear()}-${Math.floor(
      (d.getMonth() * 4.33 + d.getDate() / 7) * 10
    )}`;
    if (seen.has(weekKey)) return false;
    seen.add(weekKey);
    return true;
  });
}

async function safeFred(
  id: string,
  opts?: { thinned?: boolean; count?: number }
): Promise<{
  value: number | null;
  date: string | null;
  history: { date: string; value: number }[];
  status: "ok" | "error";
  error?: string;
}> {
  try {
    const obs = await fetchFredCsv(id);
    if (!obs.length) throw new Error("empty");
    const latest = last(obs)!;
    const history = opts?.thinned ? thinWeekly(obs) : obs;
    return { value: latest.value, date: latest.date, history, status: "ok" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { value: null, date: null, history: [], status: "error", error: msg };
  }
}

// ── ECB SDMX-JSON helper ──────────────────────────────────────────────────────

const ECB = "https://data-api.ecb.europa.eu/service/data";

interface SdmxResponse {
  dataSets?: Array<{
    series?: Record<string, { observations?: Record<string, [number, ...unknown[]]> }>;
  }>;
  structure?: {
    dimensions?: {
      observation?: Array<{ values?: Array<{ id: string }> }>;
    };
  };
}

async function fetchEcbSeries(
  path: string,
  lastN = 36
): Promise<{ date: string; value: number }[] | null> {
  try {
    const url = `${ECB}/${path}?lastNObservations=${lastN}&format=jsondata`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const json: SdmxResponse = await res.json();
    const ds = json.dataSets?.[0];
    const seriesKey = ds ? Object.keys(ds.series ?? {})[0] : null;
    if (!seriesKey || !ds) return null;
    const obsRaw = ds.series![seriesKey].observations ?? {};
    const periods = json.structure?.dimensions?.observation?.[0]?.values ?? [];
    const result: { date: string; value: number }[] = [];
    for (const [idx, val] of Object.entries(obsRaw)) {
      const p = periods[parseInt(idx)];
      if (p && val[0] != null) result.push({ date: p.id, value: val[0] });
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}

// ── Yahoo Finance DXY ─────────────────────────────────────────────────────────

async function fetchDxy(): Promise<{
  value: number | null;
  change1d: number | null;
  change1w: number | null;
  history: { date: string; value: number }[];
  status: "ok" | "limited" | "error";
}> {
  try {
    const quote = await yf.quote("DX-Y.NYB");
    if (!quote) throw new Error("no quote");
    const value = quote.regularMarketPrice ?? null;
    const change1d = quote.regularMarketChangePercent ?? null;

    let history: { date: string; value: number }[] = [];
    let status: "ok" | "limited" | "error" = "ok";
    try {
      const result = await yf.chart("DX-Y.NYB", {
        period1: new Date(Date.now() - 365 * 3 * 24 * 60 * 60 * 1000),
        interval: "1d",
      });
      const quotes = result.quotes ?? [];
      const daily = quotes
        .filter((q) => q.close != null)
        .map((q) => ({
          date: new Date(q.date).toISOString().split("T")[0],
          value: q.close!,
        }));
      history = thinWeekly(daily);
    } catch {
      status = "limited";
    }

    // 1W change from history
    let change1w: number | null = null;
    if (value && history.length >= 5) {
      const weekAgo = history.at(-5)?.value;
      if (weekAgo) change1w = ((value - weekAgo) / weekAgo) * 100;
    }

    return { value, change1d, change1w, history, status };
  } catch {
    return { value: null, change1d: null, change1w: null, history: [], status: "error" };
  }
}

// ── OECD (graceful fail only) ─────────────────────────────────────────────────

async function fetchOecdCli(
  country: string
): Promise<{ date: string; value: number }[] | null> {
  // OECD SDMX endpoints have been unreliable — use FRED/OECD-sourced series instead
  const fredId = `${country}LOLITONOSTSAM`;
  try {
    const obs = await fetchFredCsv(fredId);
    return obs.length > 5 ? obs : null;
  } catch {
    return null;
  }
}

async function fetchOecdCpi(
  fredId: string
): Promise<{ date: string; value: number }[] | null> {
  try {
    const obs = await fetchFredCsv(fredId);
    return obs.length > 5 ? obs : null;
  } catch {
    return null;
  }
}

// ── YoY helper ────────────────────────────────────────────────────────────────
// Converts a raw index series (CPIAUCSL ~332, PCEPILFE ~129, GDP ~$32T) into
// year-over-year percent changes.  lookback=12 for monthly, 4 for quarterly.

type SafeFredResult = Awaited<ReturnType<typeof safeFred>>;

function toYoY(raw: SafeFredResult, lookback = 12): SafeFredResult {
  if (raw.status === "error") return raw;
  const hist = raw.history;
  const yoyHist: { date: string; value: number }[] = [];
  for (let i = lookback; i < hist.length; i++) {
    const cur  = hist[i];
    const prev = hist[i - lookback];
    if (cur && prev && prev.value > 0) {
      yoyHist.push({
        date:  cur.date,
        value: parseFloat(((cur.value / prev.value - 1) * 100).toFixed(3)),
      });
    }
  }
  const latest = yoyHist.at(-1);
  return { value: latest?.value ?? null, date: latest?.date ?? null, history: yoyHist, status: "ok" };
}

// ── Shiller CAPE (FRED → Yale fallback) ──────────────────────────────────────

type SafeFredReturn = {
  value: number | null;
  date: string | null;
  history: { date: string; value: number }[];
  status: "ok" | "error";
  error?: string;
};

const CAPE_STALE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

async function fetchCape(): Promise<SafeFredReturn> {
  const fredResult = await safeFred("CAPE");
  const fredIsFresh =
    fredResult.status === "ok" &&
    fredResult.history.length > 0 &&
    fredResult.date != null &&
    Date.now() - new Date(fredResult.date).getTime() < CAPE_STALE_MS;

  console.log(`[CAPE] FRED: status=${fredResult.status} pts=${fredResult.history.length} date=${fredResult.date ?? "null"} fresh=${fredIsFresh}`);

  if (fredIsFresh) return fredResult;

  // FRED returned empty or stale — fall back to Robert Shiller's Yale dataset
  try {
    console.log("[CAPE] trying Yale fallback...");
    const obs = await fetchShillerCapeYale();
    if (!obs.length) throw new Error("Yale dataset returned no rows");
    const latest = obs.at(-1)!;
    console.log(`[CAPE] Yale OK: ${obs.length} pts, latest=${latest.date} val=${latest.value.toFixed(1)}`);
    return { value: latest.value, date: latest.date, history: obs, status: "ok" };
  } catch (yaleErr) {
    const fredMsg = fredResult.error ?? "empty";
    const yaleMsg = yaleErr instanceof Error ? yaleErr.message : String(yaleErr);
    console.error(`[CAPE] Yale FAILED: ${yaleMsg}`);
    return {
      value: null,
      date: null,
      history: [],
      status: "error",
      error: `FRED: ${fredMsg} | Yale: ${yaleMsg}`,
    };
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic"; // always run live — called only by cron, not browser
export const maxDuration = 60;

export async function GET() {
  const errors: string[] = [];

  // ── US macro (FRED) ──────────────────────────────────────────────────────
  const [cpiRaw, pceRaw, gdpRaw, unrate, fedFunds, t10yie, dfii10, cape] =
    await Promise.all([
      safeFred("CPIAUCSL"),
      safeFred("PCEPILFE"),
      safeFred("GDP"),
      safeFred("UNRATE"),
      safeFred("FEDFUNDS", { thinned: true }),
      safeFred("T10YIE", { thinned: true }),
      safeFred("DFII10", { thinned: true }),
      fetchCape(),
    ]);

  // Convert index levels → YoY % changes
  const cpi  = toYoY(cpiRaw,  12);  // monthly → 12-month lookback
  const pce  = toYoY(pceRaw,  12);
  const gdp  = toYoY(gdpRaw,   4);  // quarterly → 4-quarter lookback

  for (const [label, r] of [
    ["CPIAUCSL", cpi],
    ["PCEPILFE", pce],
    ["GDP", gdp],
    ["UNRATE", unrate],
    ["FEDFUNDS", fedFunds],
    ["T10YIE", t10yie],
    ["DFII10", dfii10],
    ["CAPE", cape],
  ] as const) {
    if (r.status === "error") errors.push(`${label}: ${r.error}`);
  }

  // ── ECB rates (FRED public CSV) ───────────────────────────────────────────
  const [ecbDfr, ecbMlfr, ecbMrrfr] = await Promise.all([
    safeFred("ECBDFR"),
    safeFred("ECBMLFR"),
    safeFred("ECBMRRFR"),
  ]);

  // ── ECB HICP & GDP (ECB SDMX-JSON) ───────────────────────────────────────
  const [ecbHicpRaw, ecbGdpRaw] = await Promise.all([
    fetchEcbSeries("ICP/M.U2.N.000000.4.ANR", 36),
    fetchEcbSeries("MNA/Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY", 20),
  ]);

  const ecbHicp = ecbHicpRaw
    ? {
        value: last(ecbHicpRaw)?.value ?? null,
        date: last(ecbHicpRaw)?.date ?? null,
        history: ecbHicpRaw,
        status: "ok" as const,
        source: "ECB SDMX-JSON",
        label: "Euro Area HICP YoY %",
      }
    : { value: null, date: null, history: [], status: "error" as const, source: "ECB SDMX-JSON", label: "Euro Area HICP YoY %" };

  const ecbGdp = ecbGdpRaw
    ? {
        value: last(ecbGdpRaw)?.value ?? null,
        date: last(ecbGdpRaw)?.date ?? null,
        history: ecbGdpRaw,
        status: "ok" as const,
        source: "ECB SDMX-JSON",
        label: "Euro Area GDP YoY %",
      }
    : { value: null, date: null, history: [], status: "error" as const, source: "ECB SDMX-JSON", label: "Euro Area GDP YoY %" };

  // ── OECD CLI (FRED/OECD-sourced, graceful fail) ───────────────────────────
  const cliCountries = ["USA", "CHN", "JPN", "KOR", "BRA", "MEX", "COL", "OEC"] as const;
  const cliLabels: Record<string, string> = {
    USA: "United States", CHN: "China", JPN: "Japan", KOR: "Korea",
    BRA: "Brazil", MEX: "Mexico", COL: "Colombia", OEC: "OECD Total",
  };

  const cliResults = await Promise.all(
    cliCountries.map(async (c) => {
      const data = await fetchOecdCli(c);
      return {
        country: c,
        label: cliLabels[c],
        value: data ? last(data)?.value ?? null : null,
        date: data ? last(data)?.date ?? null : null,
        history: data ?? [],
        status: (data ? "ok" : "unavailable") as "ok" | "unavailable",
        source: "FRED/OECD",
      };
    })
  );

  // ── Country CPI (FRED/OECD-sourced, graceful fail) ────────────────────────
  const cpiSeries: [string, string, string][] = [
    ["JPNCPALTT01IXOBSAM", "JPN", "Japan"],
    ["KORCPALTT01IXOBSAM", "KOR", "Korea"],
    ["AUSCPALTT01IXOBSAM", "AUS", "Australia"],
    ["GBRCPALTT01IXOBSAM", "GBR", "United Kingdom"],
    ["DEUCPALTT01IXOBSAM", "DEU", "Germany"],
    ["FRACPALTT01IXOBSAM", "FRA", "France"],
  ];

  const countryCpiResults = await Promise.all(
    cpiSeries.map(async ([fredId, code, label]) => {
      const data = await fetchOecdCpi(fredId);
      return {
        country: code,
        label,
        fredId,
        value: data ? last(data)?.value ?? null : null,
        date: data ? last(data)?.date ?? null : null,
        history: data ?? [],
        status: (data ? "ok" : "unavailable") as "ok" | "unavailable",
        source: "FRED/OECD",
      };
    })
  );

  // ── US Dollar Index ───────────────────────────────────────────────────────
  const dxy = await fetchDxy();

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    usMacro: {
      cpi: {
        ...cpi,
        fredId: "CPIAUCSL",
        label: "US CPI YoY %",
        source: "FRED",
        frequency: "monthly",
      },
      corePce: {
        ...pce,
        fredId: "PCEPILFE",
        label: "Core PCE YoY %",
        source: "FRED",
        frequency: "monthly",
      },
      gdp: {
        ...gdp,
        fredId: "GDP",
        label: "US Real GDP YoY %",
        source: "FRED",
        frequency: "quarterly",
      },
      unemployment: {
        ...unrate,
        fredId: "UNRATE",
        label: "US Unemployment Rate %",
        source: "FRED",
        frequency: "monthly",
      },
      fedFundsRate: {
        ...fedFunds,
        fredId: "FEDFUNDS",
        label: "Fed Funds Rate %",
        source: "FRED",
        frequency: "monthly",
      },
      breakeven10y: {
        ...t10yie,
        fredId: "T10YIE",
        label: "10Y Breakeven Inflation %",
        source: "FRED",
        frequency: "daily",
      },
      realYield10y: {
        ...dfii10,
        fredId: "DFII10",
        label: "Real 10Y Treasury Yield %",
        source: "FRED",
        frequency: "daily",
      },
      shillerCape: {
        ...cape,
        fredId: "CAPE",
        label: "Shiller CAPE Ratio",
        source: "FRED",
        frequency: "monthly",
      },
    },
    dxy: {
      ...dxy,
      ticker: "DX-Y.NYB",
      label: "US Dollar Index (DXY)",
      source: "Yahoo Finance",
    },
    eurArea: {
      hicp: ecbHicp,
      gdp: ecbGdp,
      depositRate: {
        ...ecbDfr,
        fredId: "ECBDFR",
        label: "ECB Deposit Facility Rate %",
        source: "FRED",
      },
      marginalLendingRate: {
        ...ecbMlfr,
        fredId: "ECBMLFR",
        label: "ECB Marginal Lending Rate %",
        source: "FRED",
      },
      mainRefiRate: {
        ...ecbMrrfr,
        fredId: "ECBMRRFR",
        label: "ECB Main Refinancing Rate %",
        source: "FRED",
      },
    },
    oecd: {
      cli: cliResults,
      countryCpi: countryCpiResults,
      note:
        "OECD SDMX-JSON endpoints unavailable; using FRED/OECD-sourced series (LOLITONOSTSAM / CPALTT01IXOBSAM). Data may lag 1–2 months.",
    },
    meta: {
      fetchedAt: new Date().toISOString(),
      fredKeyPresent: !!process.env.FRED_API_KEY,
      errors: errors.length ? errors : undefined,
    },
  });
}
