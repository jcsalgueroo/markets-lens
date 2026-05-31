import { kvGet } from "@/lib/kv";
import { fmtDate, fmtNum, changeColor } from "@/lib/formatters";
import { TabNav, type TabDef } from "@/components/ui/TabNav";
import { SectionCard } from "@/components/ui/SectionCard";
import { ValBadge } from "@/components/ui/ValBadge";
import { EquityTable } from "@/components/dashboard/EquityTable";
import { SectorTable } from "@/components/dashboard/SectorTable";
import { TreasuryTable } from "@/components/dashboard/TreasuryTable";
import { CreditTable } from "@/components/dashboard/CreditTable";
import { SpreadsPanel } from "@/components/dashboard/SpreadsPanel";
import { CommoditiesTable } from "@/components/dashboard/CommoditiesTable";
import { ValuationPanel } from "@/components/dashboard/ValuationPanel";
import { ColombiaPanel } from "@/components/dashboard/ColombiaPanel";
import { GlobalMacroPanel } from "@/components/dashboard/GlobalMacroPanel";
import { SignalsBar } from "@/components/dashboard/SignalsBar";
import { IndexHistoryChart } from "@/components/charts/IndexHistoryChart";
import { SectorBarChart } from "@/components/charts/SectorBarChart";
import { YieldHistoryChart } from "@/components/charts/YieldHistoryChart";
import { CommoditiesHistoryChart } from "@/components/charts/CommoditiesHistoryChart";
import { TRMHistoryChart } from "@/components/charts/TRMHistoryChart";
import { GlobalMacroChart } from "@/components/charts/GlobalMacroChart";
import { YieldCurveChart } from "@/components/charts/YieldCurveChart";
import { GoldCopperRatioChart } from "@/components/charts/GoldCopperRatioChart";
import { PrintButton } from "@/components/ui/PrintButton";
import { StalenessAlert } from "@/components/ui/StalenessAlert";

import type {
  EquitiesSnapshot,
  FixedIncomeSnapshot,
  CommoditiesSnapshot,
  ValuationSnapshot,
  ColombiaSnapshot,
  GlobalSnapshot,
} from "@/lib/types";

// Always render server-side — reads fresh KV snapshots on every request.
// KV reads are fast (<50ms), so no need for ISR caching here.
// The KV data itself is the cache layer (refreshed once daily by cron).
export const dynamic = "force-dynamic";

// ── Key Metrics Strip ─────────────────────────────────────────────────────────

interface MetricPillProps {
  label: string;
  value: string;
  change?: number | null;
}

function MetricPill({ label, value, change }: MetricPillProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0">
      <span className="text-slate-500 text-[10px] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-slate-100 text-xs font-medium tabular-nums">
        {value}
      </span>
      {change != null && (
        <span className={`text-[10px] tabular-nums ${changeColor(change)}`}>
          {change >= 0 ? "+" : ""}{change.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

interface KeyMetricsProps {
  eq: EquitiesSnapshot | null;
  fi: FixedIncomeSnapshot | null;
  com: CommoditiesSnapshot | null;
  col: ColombiaSnapshot | null;
  glb: GlobalSnapshot | null;
}

function KeyMetricsStrip({ eq, fi, com, col, glb }: KeyMetricsProps) {
  const sp500   = eq?.usBroad.find((e) => e.ticker === "^GSPC");
  const ndx     = eq?.usBroad.find((e) => e.ticker === "^NDX");
  const stoxx   = eq?.europe.find((e) => e.ticker === "^STOXX");
  const icolcap = eq?.em.find((e) => e.ticker === "ICOLCAP.CL");
  const tnx     = fi?.treasuries.find((t) => t.ticker === "^TNX");
  const gold    = com?.metals.find((c) => c.ticker === "GC=F");
  const brent   = com?.energy.find((c) => c.ticker === "BZ=F");
  const wti     = com?.energy.find((c) => c.ticker === "CL=F");
  const trm     = col?.trm;
  const dxy     = glb?.dxy;

  const pills: MetricPillProps[] = [
    {
      label: "S&P 500",
      value: sp500?.price != null ? fmtNum(sp500.price, 2) : "—",
      change: sp500?.returns["1D"] ?? null,
    },
    {
      label: "NDX",
      value: ndx?.price != null ? fmtNum(ndx.price, 2) : "—",
      change: ndx?.returns["1D"] ?? null,
    },
    {
      label: "STOXX 600",
      value: stoxx?.price != null ? fmtNum(stoxx.price, 2) : "—",
      change: stoxx?.returns["1D"] ?? null,
    },
    {
      label: "10Y Yield",
      value: tnx?.yieldLevel != null ? `${tnx.yieldLevel.toFixed(3)}%` : "—",
    },
    {
      label: "Gold",
      value: gold?.priceUsd != null ? `$${fmtNum(gold.priceUsd, 2)}` : "—",
      change: gold?.returns["1D"] ?? null,
    },
    {
      label: "Brent",
      value: brent?.priceUsd != null ? `$${fmtNum(brent.priceUsd, 2)}` : "—",
      change: brent?.returns["1D"] ?? null,
    },
    {
      label: "WTI",
      value: wti?.priceUsd != null ? `$${fmtNum(wti.priceUsd, 2)}` : "—",
      change: wti?.returns["1D"] ?? null,
    },
    {
      label: "ICOLCAP",
      value: icolcap?.price != null ? fmtNum(icolcap.price, 2) : "—",
      change: icolcap?.returns["1D"] ?? null,
    },
    {
      label: "TRM COP/USD",
      value: trm?.current != null ? fmtNum(trm.current, 2) : "—",
      change: trm?.returns["1D"] ?? null,
    },
    {
      label: "DXY",
      value: dxy?.value != null ? fmtNum(dxy.value, 2) : "—",
      change: dxy?.change1d ?? null,
    },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto px-4 md:px-6 py-4 border-b border-slate-800">
      {pills.map((p) => (
        <MetricPill key={p.label} {...p} />
      ))}
    </div>
  );
}

// ── Tab content builders ──────────────────────────────────────────────────────

const US_BROAD_SERIES = [
  { id: "^GSPC", label: "S&P 500",     color: "#38bdf8" },
  { id: "^NDX",  label: "Nasdaq 100",  color: "#a78bfa" },
  { id: "^RUT",  label: "Russell 2000", color: "#fbbf24" },
  { id: "^DJI",  label: "Dow Jones",   color: "#fb7185" },
];

function EquitiesTab({ eq }: { eq: EquitiesSnapshot | null }) {
  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="US Broad — Normalized Price History">
          <IndexHistoryChart seriesDefs={US_BROAD_SERIES} defaultTimeframe="1Y" />
        </SectionCard>
        <SectionCard title="Sector Performance">
          <SectorBarChart
            rows={eq?.usSectors ?? []}
            spRow={eq?.usBroad.find((e) => e.ticker === "^GSPC") ?? null}
          />
        </SectionCard>
      </div>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="US Broad Markets">
          <EquityTable rows={eq?.usBroad ?? []} />
        </SectionCard>
        <SectionCard title="US Factor ETFs">
          <EquityTable rows={eq?.usFactors ?? []} />
        </SectionCard>
      </div>

      <SectionCard title="US Sectors — vs S&P 500">
        <SectorTable rows={eq?.usSectors ?? []} />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Europe (Local Currency)">
          <EquityTable rows={eq?.europe ?? []} showCurrency />
        </SectionCard>
        <SectionCard title="Asia-Pacific (Local Currency)">
          <EquityTable rows={eq?.asia ?? []} showCurrency />
        </SectionCard>
      </div>

      <SectionCard title="Emerging Markets">
        <EquityTable rows={eq?.em ?? []} showCurrency />
      </SectionCard>
    </div>
  );
}

function FixedIncomeTab({ fi }: { fi: FixedIncomeSnapshot | null }) {
  return (
    <div className="space-y-6">
      {/* Charts row: time-series history + current curve shape */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="US Treasury Yield History">
          <YieldHistoryChart defaultTimeframe="1Y" />
        </SectionCard>
        <SectionCard title="Yield Curve">
          <YieldCurveChart
            curve={fi?.yieldCurve ?? []}
            asOf={fi?.asOf ?? null}
          />
        </SectionCard>
      </div>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="US Treasuries">
          <TreasuryTable rows={fi?.treasuries ?? []} />
        </SectionCard>
        <SectionCard title="Credit ETFs">
          <CreditTable rows={fi?.creditEtfs ?? []} />
        </SectionCard>
      </div>

      <SectionCard title="Key Spreads &amp; Credit OAS">
        <SpreadsPanel
          spreads={fi?.spreads ?? []}
          curve={fi?.yieldCurve ?? []}
          oasData={fi?.oasData}
        />
      </SectionCard>

      <SectionCard title="Credit Spread History — HY vs IG OAS">
        <GlobalMacroChart
          dataset="fixed-income"
          seriesDefs={OAS_HISTORY_SERIES}
          defaultTimeframe="3Y"
          height={240}
          note="ICE BofA Option-Adjusted Spreads · Source: FRED BAMLH0A0HYM2 / BAMLC0A0CM · daily"
        />
      </SectionCard>
    </div>
  );
}

// Brent absolute price series — reads from the commodities blob
const BRENT_SERIES = [
  { id: "BZ=F", label: "Brent Crude ($/bbl)", color: "#a78bfa", format: "index" as const },
];

function CommoditiesTab({ com }: { com: CommoditiesSnapshot | null }) {
  return (
    <div className="space-y-6">
      {/* Normalized multi-commodity performance */}
      <SectionCard title="Commodities — Normalized Price History">
        <CommoditiesHistoryChart defaultTimeframe="1Y" />
      </SectionCard>

      {/* Brent absolute price + Gold/Copper ratio side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Brent Crude — Price ($/bbl)">
          <GlobalMacroChart
            dataset="commodities"
            seriesDefs={BRENT_SERIES}
            defaultTimeframe="1Y"
            height={240}
            note="Brent crude front-month contract · $/barrel · weekly · Source: Yahoo Finance BZ=F"
          />
        </SectionCard>
        <SectionCard title="Gold / Copper Ratio">
          <GoldCopperRatioChart defaultTimeframe="1Y" />
        </SectionCard>
      </div>

      {/* Snapshot table */}
      <SectionCard title="Commodities">
        <CommoditiesTable
          energy={com?.energy ?? []}
          metals={com?.metals ?? []}
          agriculture={com?.agriculture ?? []}
          derived={com?.derived ?? null}
        />
      </SectionCard>
    </div>
  );
}

// ── Fixed-income OAS series ───────────────────────────────────────────────────

const OAS_HISTORY_SERIES = [
  { id: "HY_OAS", label: "US HY OAS", color: "#f87171", format: "pct" as const }, // rose
  { id: "IG_OAS", label: "US IG OAS", color: "#38bdf8", format: "pct" as const }, // sky
];

// ── Valuation chart series definitions ────────────────────────────────────────

const CAPE_SERIES = [
  { id: "CAPE", label: "Shiller CAPE", color: "#a78bfa", format: "ratio" as const },
];

// Shiller CAPE long-run average: ~16.8× (1881–present).
// "Fair value" upper bound: ~25× (one std dev above mean).
const CAPE_REFERENCE_LINES = [
  { y: 16.8, label: "Hist. avg  16.8×", color: "#34d399", dashed: true },
  { y: 25,   label: "Rich  25×",         color: "#fbbf24", dashed: true },
];

const REAL_YIELD_VALUATION_SERIES = [
  { id: "DFII10", label: "Real 10Y Yield",      color: "#38bdf8", format: "pct" as const },
  { id: "T10YIE", label: "10Y Breakeven Infl.", color: "#fb923c", format: "pct" as const },
];

// ── Global macro series definitions ───────────────────────────────────────────

const RATE_CYCLE_SERIES = [
  { id: "FEDFUNDS", label: "Fed Funds Rate", color: "#f87171", format: "pct" as const }, // red
  { id: "CPI",      label: "CPI YoY",        color: "#fbbf24", format: "pct" as const }, // amber
  { id: "CorePCE",  label: "Core PCE YoY",   color: "#a78bfa", format: "pct" as const }, // violet
];

const REAL_YIELD_SERIES = [
  { id: "DFII10", label: "Real 10Y Yield",      color: "#38bdf8", format: "pct" as const }, // sky
  { id: "T10YIE", label: "10Y Breakeven Infl.", color: "#fb923c", format: "pct" as const }, // orange
];

const DXY_SERIES = [
  { id: "DXY", label: "DXY — US Dollar Index", color: "#34d399", format: "index" as const }, // emerald
];

const GDP_SERIES = [
  { id: "GDP", label: "US Real GDP YoY %", color: "#34d399", format: "pct" as const }, // emerald
];

// Key countries for the CLI chart — US, OECD Total, Colombia, China
// Series IDs match CLI_{COUNTRY} keys written by extractGlobalHistory
const CLI_SERIES = [
  { id: "CLI_USA", label: "United States", color: "#38bdf8", format: "index" as const }, // sky
  { id: "CLI_OEC", label: "OECD Total",    color: "#94a3b8", format: "index" as const }, // slate
  { id: "CLI_COL", label: "Colombia",      color: "#fbbf24", format: "index" as const }, // amber
  { id: "CLI_CHN", label: "China",         color: "#f87171", format: "index" as const }, // rose
];

const CLI_REFERENCE_LINES = [
  { y: 100, label: "Trend  100", color: "#475569", dashed: true },
];

function MacroTab({
  colombia,
  global,
}: {
  colombia: ColombiaSnapshot | null;
  global: GlobalSnapshot | null;
}) {
  return (
    <div className="space-y-6">
      {/* Global macro charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="US Rate Cycle — Fed Funds vs Inflation">
          <GlobalMacroChart
            seriesDefs={RATE_CYCLE_SERIES}
            defaultTimeframe="3Y"
            height={240}
            yAxisDomain={[0, "auto"]}
          />
        </SectionCard>
        <SectionCard title="Real Yields &amp; Breakeven Inflation">
          <GlobalMacroChart seriesDefs={REAL_YIELD_SERIES} defaultTimeframe="3Y" height={240} zeroLine />
        </SectionCard>
      </div>

      {/* GDP growth + DXY side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="US Real GDP — YoY Growth">
          <GlobalMacroChart
            seriesDefs={GDP_SERIES}
            defaultTimeframe="3Y"
            height={220}
            zeroLine
            note="US Real GDP quarterly YoY % growth · Source: FRED GDP"
          />
        </SectionCard>
        <SectionCard title="DXY — US Dollar Index">
          <GlobalMacroChart
            seriesDefs={DXY_SERIES}
            defaultTimeframe="3Y"
            height={220}
            yAxisDomain={["auto", "auto"]}
          />
        </SectionCard>
      </div>

      {/* OECD Composite Leading Indicators */}
      <SectionCard title="OECD Composite Leading Indicators">
        <GlobalMacroChart
          seriesDefs={CLI_SERIES}
          defaultTimeframe="3Y"
          height={260}
          referenceLines={CLI_REFERENCE_LINES}
          yAxisDomain={["auto", "auto"]}
          note="CLI index ≈ 100 = long-run trend growth rate · &gt;100 above-trend expansion · &lt;100 below-trend contraction · Source: FRED / OECD (LOLITONOSTSAM) · monthly"
        />
      </SectionCard>

      {/* Colombia charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="TRM — USD/COP Exchange Rate">
          <TRMHistoryChart series={["USDCOP"]} defaultTimeframe="1Y" height={220} />
        </SectionCard>
        <SectionCard title="Oil Price in Colombian Pesos">
          <TRMHistoryChart series={["OilCOP"]} defaultTimeframe="1Y" height={220} />
        </SectionCard>
      </div>

      <SectionCard title="Colombia — Macro &amp; Local Markets">
        <ColombiaPanel data={colombia} />
      </SectionCard>
      <SectionCard title="Global Macro">
        <GlobalMacroPanel data={global} />
      </SectionCard>
    </div>
  );
}

function ValuationTab({
  valuation,
}: {
  valuation: ValuationSnapshot | null;
}) {
  return (
    <div className="space-y-6">
      {/* Historical context charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Shiller CAPE — Historical Valuation">
          <GlobalMacroChart
            seriesDefs={CAPE_SERIES}
            defaultTimeframe="3Y"
            height={240}
            referenceLines={CAPE_REFERENCE_LINES}
            note="Shiller Cyclically Adjusted P/E · monthly · source: FRED / Robert Shiller"
          />
        </SectionCard>
        <SectionCard title="Real Yields &amp; Breakeven Inflation">
          <GlobalMacroChart
            seriesDefs={REAL_YIELD_VALUATION_SERIES}
            defaultTimeframe="3Y"
            height={240}
            zeroLine
            note="Rising real yields compress equity multiples — the discount rate effect"
          />
        </SectionCard>
      </div>

      {/* Current snapshot */}
      <SectionCard
        title="Equity Valuation &amp; Credit Yields"
        badge={
          valuation?.derived.marketBadge ? (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              Market signal:
              <ValBadge badge={valuation.derived.marketBadge} />
            </div>
          ) : undefined
        }
      >
        <ValuationPanel data={valuation} />
      </SectionCard>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Dashboard() {
  let equities: EquitiesSnapshot | null = null;
  let fi: FixedIncomeSnapshot | null = null;
  let commodities: CommoditiesSnapshot | null = null;
  let valuation: ValuationSnapshot | null = null;
  let colombia: ColombiaSnapshot | null = null;
  let global: GlobalSnapshot | null = null;

  try {
    [equities, fi, commodities, valuation, colombia, global] =
      await Promise.all([
        kvGet<EquitiesSnapshot>("snapshot:equities"),
        kvGet<FixedIncomeSnapshot>("snapshot:fixed-income"),
        kvGet<CommoditiesSnapshot>("snapshot:commodities"),
        kvGet<ValuationSnapshot>("snapshot:valuation"),
        kvGet<ColombiaSnapshot>("snapshot:macro:colombia"),
        kvGet<GlobalSnapshot>("snapshot:macro:global"),
      ]);
  } catch {
    // KV unavailable (local dev without env vars) — all sections show empty state
  }

  const asOf = equities?.asOf ?? fi?.asOf ?? null;

  const TABS: TabDef[] = [
    { id: "equities",     label: "Equities",      badge: `${(equities?.usBroad.length ?? 0) + (equities?.usSectors.length ?? 0) + (equities?.usFactors.length ?? 0) + (equities?.europe.length ?? 0) + (equities?.asia.length ?? 0) + (equities?.em.length ?? 0) || ""}` || undefined },
    { id: "fixed-income", label: "Fixed Income" },
    { id: "commodities",  label: "Commodities" },
    { id: "macro",        label: "Macro" },
    { id: "valuation",    label: "Valuation" },
  ];

  const PANELS = {
    "equities":     <EquitiesTab eq={equities} />,
    "fixed-income": <FixedIncomeTab fi={fi} />,
    "commodities":  <CommoditiesTab com={commodities} />,
    "macro":        <MacroTab colombia={colombia} global={global} />,
    "valuation":    <ValuationTab valuation={valuation} />,
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <svg
              className="w-5 h-5 text-sky-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span className="text-sky-400 font-semibold tracking-tight">
              MarketLens
            </span>
            <span className="hidden md:inline text-slate-600 text-xs border-l border-slate-800 pl-3">
              Professional Macro Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            <PrintButton />
            <div className="text-slate-500 text-[11px] tabular-nums text-right">
              {asOf ? (
                <>
                  <span className="text-slate-400">Refreshed </span>
                  {fmtDate(asOf)}
                </>
              ) : (
                <span className="text-amber-600">
                  Awaiting first data refresh — cron runs weekdays 06:00 UTC
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Staleness alert (client-side, weekdays only) ─────────────────── */}
      <StalenessAlert asOf={asOf} />

      {/* ── Key Metrics Strip ────────────────────────────────────────────── */}
      <KeyMetricsStrip
        eq={equities}
        fi={fi}
        com={commodities}
        col={colombia}
        glb={global}
      />

      {/* ── Market Regime Signals ────────────────────────────────────────── */}
      <SignalsBar eq={equities} fi={fi} col={colombia} glb={global} />

      {/* ── Tabbed Content ───────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto">
        <TabNav
          tabs={TABS}
          panels={PANELS}
          defaultTab="equities"
        />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 mt-6">
        <div className="max-w-[1600px] mx-auto px-6 py-4 space-y-2">
          {/* Print-only: snapshot date so every PDF is self-documenting */}
          {asOf && (
            <p className="hidden print:block text-slate-600 text-[10px] mb-1">
              Data snapshot:{" "}
              {new Date(asOf).toLocaleString("en-US", {
                month: "long", day: "numeric", year: "numeric",
                hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
              })}
            </p>
          )}

          {/* FRED® required attribution */}
          <p className="text-slate-600 text-[10px] leading-relaxed">
            This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.
            By using this application you agree to be bound by the{" "}
            <a
              href="https://fred.stlouisfed.org/docs/api/terms_of_use.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-400 transition-colors"
            >
              FRED® API Terms of Use
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <p className="text-slate-700 text-[10px]">
              MarketLens · Data: Yahoo Finance, FRED®, ECB SDMX, datos.gov.co
            </p>
            <p className="text-slate-700 text-[10px]">
              Snapshots: Mon–Fri 06:00 UTC · History: Sundays 05:00 UTC
            </p>
          </div>
          <p className="text-slate-800 text-[10px]">
            © {new Date().getFullYear()} Juan Camilo Salguero
          </p>
        </div>
      </footer>
    </div>
  );
}
