/**
 * SignalsBar — Market Regime quick-read.
 *
 * A horizontal row of color-coded chips (green/amber/red) computed from
 * live snapshot data.  Renders between the key metrics strip and the tab
 * nav so the regime picture is visible at all times regardless of the
 * active tab.  Hidden when all sources are unavailable (first run / error).
 */
import type {
  EquitiesSnapshot,
  FixedIncomeSnapshot,
  ColombiaSnapshot,
  GlobalSnapshot,
} from "@/lib/types";

// ── Signal type ───────────────────────────────────────────────────────────────

type SignalStatus = "green" | "amber" | "red" | "na";

interface Signal {
  category: string;
  label: string;
  value?: string;    // small sub-label (e.g. "−0.20pp")
  status: SignalStatus;
  tooltip: string;   // hover methodology explanation
}

// ── Colour map ────────────────────────────────────────────────────────────────

const COLORS: Record<SignalStatus, { border: string; text: string; bg: string }> = {
  green: {
    border: "border-emerald-500/30",
    text:   "text-emerald-400",
    bg:     "bg-emerald-500/5",
  },
  amber: {
    border: "border-amber-500/30",
    text:   "text-amber-400",
    bg:     "bg-amber-500/5",
  },
  red: {
    border: "border-rose-500/30",
    text:   "text-rose-400",
    bg:     "bg-rose-500/5",
  },
  na: {
    border: "border-slate-800",
    text:   "text-slate-600",
    bg:     "",
  },
};

// ── Signal computation ────────────────────────────────────────────────────────

function computeSignals(
  eq:  EquitiesSnapshot  | null,
  fi:  FixedIncomeSnapshot | null,
  col: ColombiaSnapshot  | null,
  glb: GlobalSnapshot    | null,
): Signal[] {
  // ── 1. Yield Curve (2Y10Y spread) ─────────────────────────────────────────
  const curveSpread =
    fi?.spreads.find((s) => s.label.startsWith("2Y10Y"))?.value ?? null;

  const curveSignal: Signal = {
    category: "Yield Curve",
    label:
      curveSpread == null ? "No data"
      : curveSpread < 0   ? "Inverted"
      : curveSpread < 0.3 ? "Flat"
      :                     "Normal",
    value:
      curveSpread != null
        ? `${curveSpread >= 0 ? "+" : ""}${curveSpread.toFixed(2)}pp 2Y10Y`
        : undefined,
    status:
      curveSpread == null ? "na"
      : curveSpread < 0   ? "red"
      : curveSpread < 0.3 ? "amber"
      :                     "green",
    tooltip:
      "2Y10Y spread (10Y minus 2Y Treasury yield).\n" +
      "🟢 Normal  > +0.30pp\n" +
      "🟡 Flat    0 to +0.30pp\n" +
      "🔴 Inverted < 0pp — historically precedes recessions.\n" +
      "Source: Yahoo Finance (10Y) + FRED DGS2.",
  };

  // ── 2. HY Credit Stress (ICE BofA OAS via FRED) ───────────────────────────
  const hyOas = fi?.oasData?.hyOas.value ?? null;

  const hyOasSignal: Signal = {
    category: "HY Credit OAS",
    label:
      hyOas == null  ? "No data"
      : hyOas > 5.5  ? "Elevated"
      : hyOas > 3.5  ? "Normal"
      :                "Tight",
    value: hyOas != null ? `${hyOas.toFixed(2)}%` : undefined,
    status:
      hyOas == null ? "na"
      : hyOas > 5.5 ? "red"
      : hyOas > 3.5 ? "amber"
      :               "green",
    tooltip:
      "ICE BofA US High Yield Option-Adjusted Spread.\n" +
      "🟢 Tight    < 3.50% — risk-on, credit benign\n" +
      "🟡 Normal   3.50–5.50%\n" +
      "🔴 Elevated > 5.50% — credit stress / risk-off\n" +
      "Source: FRED BAMLH0A0HYM2.",
  };

  // ── 3. US Equity Trend (S&P 500 1M) ──────────────────────────────────────
  const sp1m =
    eq?.usBroad.find((e) => e.ticker === "^GSPC")?.returns["1M"] ?? null;

  const equitySignal: Signal = {
    category: "US Equities",
    label:
      sp1m == null  ? "No data"
      : sp1m > 2    ? "Bullish"
      : sp1m < -2   ? "Bearish"
      :               "Mixed",
    value:
      sp1m != null
        ? `S&P ${sp1m >= 0 ? "+" : ""}${sp1m.toFixed(1)}% 1M`
        : undefined,
    status:
      sp1m == null ? "na"
      : sp1m > 2   ? "green"
      : sp1m < -2  ? "red"
      :              "amber",
    tooltip:
      "S&P 500 trailing 1-month total return.\n" +
      "🟢 Bullish  > +2%\n" +
      "🟡 Mixed    −2% to +2%\n" +
      "🔴 Bearish  < −2%\n" +
      "Source: Yahoo Finance ^GSPC.",
  };

  // ── 4. Fed Policy (rate level + PCE context) ──────────────────────────────
  const fedFunds = glb?.usMacro.fedFundsRate.value ?? null;
  const corePce  = glb?.usMacro.corePce.value     ?? null;

  let fedLabel: string;
  let fedStatus: SignalStatus;
  if (fedFunds == null) {
    fedLabel  = "No data";
    fedStatus = "na";
  } else if (fedFunds >= 5) {
    fedLabel  = "Restrictive";
    fedStatus = "amber";
  } else if (fedFunds >= 2.5) {
    fedLabel  = "Normalizing";
    fedStatus = "green";
  } else {
    fedLabel  = "Accommodative";
    fedStatus = "green";
  }

  const fedSignal: Signal = {
    category: "Fed Policy",
    label: fedLabel,
    value:
      fedFunds != null
        ? `${fedFunds.toFixed(2)}%${corePce != null ? ` · PCE ${corePce.toFixed(1)}%` : ""}`
        : undefined,
    status: fedStatus,
    tooltip:
      "Effective Federal Funds Rate level.\n" +
      "🟢 Normalizing  2.50–5.00% (cuts in progress or near neutral)\n" +
      "🟢 Accommodative < 2.50% (supportive for risk assets)\n" +
      "🟡 Restrictive  ≥ 5.00% (headwind for equities and credit)\n" +
      "Core PCE shown for inflation context.\n" +
      "Source: FRED FEDFUNDS / PCEPILFE.",
  };

  // ── 5. US Dollar (DXY 1W change) ─────────────────────────────────────────
  // Dollar strengthening = negative for EM; weakening = positive for EM.
  const dxy       = glb?.dxy;
  const dxyChange = dxy?.change1w ?? null;

  const dxyLabel =
    dxy?.value == null ? "No data"
    : dxyChange == null ? "Live"
    : dxyChange > 1     ? "Strengthening"
    : dxyChange < -1    ? "Weakening"
    :                     "Stable";

  // From EM / Colombia perspective: strong USD = amber, weak/stable = green
  const dxyStatus: SignalStatus =
    dxy?.value == null ? "na"
    : dxyChange == null ? "amber"
    : dxyChange > 1     ? "amber"
    :                     "green";

  const dxySignal: Signal = {
    category: "US Dollar",
    label: dxyLabel,
    value:
      dxy?.value != null
        ? `DXY ${dxy.value.toFixed(2)}${dxyChange != null ? ` (${dxyChange >= 0 ? "+" : ""}${dxyChange.toFixed(1)}% 1W)` : ""}`
        : undefined,
    status: dxyStatus,
    tooltip:
      "DXY US Dollar Index — 1-week change.\n" +
      "🟢 Stable / Weakening  ≤ +1% 1W (positive for EM and commodities)\n" +
      "🟡 Strengthening       > +1% 1W (headwind for EM clients and COP)\n" +
      "Source: Yahoo Finance DX-Y.NYB.",
  };

  // ── 6. COP/USD Stability (TRM 1M) ────────────────────────────────────────
  // TRM 1M > 0 means COP depreciated vs USD (risk for COP-based clients).
  const trm1m = col?.trm.returns["1M"] ?? null;

  const copSignal: Signal = {
    category: "COP / USD",
    label:
      trm1m == null   ? "No data"
      : trm1m >  3    ? "COP Weak"
      : trm1m < -3    ? "COP Strong"
      :                 "Stable",
    value:
      trm1m != null
        ? `${trm1m >= 0 ? "+" : ""}${trm1m.toFixed(1)}% 1M`
        : undefined,
    status:
      trm1m == null ? "na"
      : trm1m >  3  ? "red"
      : trm1m < -3  ? "green"
      :               "amber",
    tooltip:
      "TRM (Tasa Representativa del Mercado) 1-month change.\n" +
      "Positive = COP depreciated vs USD (higher cost for COP-based clients).\n" +
      "🟢 COP Strong   < −3% 1M\n" +
      "🟡 Stable       −3% to +3% 1M\n" +
      "🔴 COP Weak     > +3% 1M (FX headwind for local investors)\n" +
      "Source: Yahoo Finance USDCOP=X.",
  };

  return [curveSignal, hyOasSignal, equitySignal, fedSignal, dxySignal, copSignal];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  eq:  EquitiesSnapshot  | null;
  fi:  FixedIncomeSnapshot | null;
  col: ColombiaSnapshot  | null;
  glb: GlobalSnapshot    | null;
}

export function SignalsBar({ eq, fi, col, glb }: Props) {
  const signals = computeSignals(eq, fi, col, glb);

  // Don't show the bar if every signal is "na" (no data yet — first run)
  const hasData = signals.some((s) => s.status !== "na");
  if (!hasData) return null;

  return (
    <div className="border-b border-slate-800 px-4 md:px-6 py-3 print:hidden">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[9px] text-slate-600 uppercase tracking-[0.12em] font-semibold">
          Market Regime
        </span>
        <div className="flex-1 h-px bg-slate-800/60" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {signals.map((sig) => {
          const c = COLORS[sig.status];
          return (
            <div
              key={sig.category}
              title={sig.tooltip}
              className={`
                flex-shrink-0 rounded-lg border px-3 py-2
                min-w-[118px] max-w-[160px] cursor-default
                ${c.border} ${c.bg}
              `}
            >
              <div className="text-[9px] text-slate-600 uppercase tracking-wider truncate mb-1">
                {sig.category}
              </div>
              <div className={`text-[11px] font-semibold leading-tight ${c.text}`}>
                {sig.label}
              </div>
              {sig.value && (
                <div className="text-[9px] text-slate-600 mt-0.5 tabular-nums leading-tight truncate">
                  {sig.value}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
