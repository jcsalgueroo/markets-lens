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
import { IndexHistoryChart } from "@/components/charts/IndexHistoryChart";
import { SectorBarChart } from "@/components/charts/SectorBarChart";
import { YieldHistoryChart } from "@/components/charts/YieldHistoryChart";

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
  const sp500 = eq?.usBroad.find((e) => e.ticker === "^GSPC");
  const ndx   = eq?.usBroad.find((e) => e.ticker === "^NDX");
  const tnx   = fi?.treasuries.find((t) => t.ticker === "^TNX");
  const gold  = com?.metals.find((c) => c.ticker === "GC=F");
  const wti   = com?.energy.find((c) => c.ticker === "CL=F");
  const trm   = col?.trm;
  const dxy   = glb?.dxy;

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
      label: "10Y Yield",
      value: tnx?.yieldLevel != null ? `${tnx.yieldLevel.toFixed(3)}%` : "—",
    },
    {
      label: "Gold",
      value: gold?.priceUsd != null ? `$${fmtNum(gold.priceUsd, 2)}` : "—",
      change: gold?.returns["1D"] ?? null,
    },
    {
      label: "WTI",
      value: wti?.priceUsd != null ? `$${fmtNum(wti.priceUsd, 2)}` : "—",
      change: wti?.returns["1D"] ?? null,
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
        <SectionCard title="Sector YTD Performance">
          <SectorBarChart rows={eq?.usSectors ?? []} />
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
      {/* Treasury yield history chart */}
      <SectionCard title="US Treasury Yield History">
        <YieldHistoryChart defaultTimeframe="1Y" />
      </SectionCard>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="US Treasuries">
          <TreasuryTable rows={fi?.treasuries ?? []} />
        </SectionCard>
        <SectionCard title="Credit ETFs">
          <CreditTable rows={fi?.creditEtfs ?? []} />
        </SectionCard>
      </div>
      <SectionCard title="Yield Curve &amp; Spreads">
        <SpreadsPanel
          spreads={fi?.spreads ?? []}
          curve={fi?.yieldCurve ?? []}
        />
      </SectionCard>
    </div>
  );
}

function CommoditiesTab({ com }: { com: CommoditiesSnapshot | null }) {
  return (
    <SectionCard title="Commodities">
      <CommoditiesTable
        energy={com?.energy ?? []}
        metals={com?.metals ?? []}
        agriculture={com?.agriculture ?? []}
        derived={com?.derived ?? null}
      />
    </SectionCard>
  );
}

function MacroTab({
  colombia,
  global,
}: {
  colombia: ColombiaSnapshot | null;
  global: GlobalSnapshot | null;
}) {
  return (
    <div className="space-y-6">
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
      </header>

      {/* ── Key Metrics Strip ────────────────────────────────────────────── */}
      <KeyMetricsStrip
        eq={equities}
        fi={fi}
        com={commodities}
        col={colombia}
        glb={global}
      />

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
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
          <p className="text-slate-700 text-[10px]">
            MarketLens · Data: Yahoo Finance, FRED, ECB SDMX, datos.gov.co
          </p>
          <p className="text-slate-700 text-[10px]">
            Snapshots: Mon–Fri 06:00 UTC · History: Sundays 05:00 UTC
          </p>
        </div>
      </footer>
    </div>
  );
}
