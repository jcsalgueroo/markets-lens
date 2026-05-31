import { NextResponse } from "next/server";
import { fetchValuations, fetchCreditYields } from "@/lib/valuation";

export const revalidate = 3600; // 1 h — valuation multiples don't move intraday
export const maxDuration = 60;

export async function GET() {
  const [equityValuations, creditYields] = await Promise.all([
    fetchValuations(),
    fetchCreditYields(),
  ]);

  // ── Summary badge across all equity ETFs ──────────────────────────────────
  const states = equityValuations.map((e) => e.badge).filter((b) => b !== "unavailable");
  const richCount  = states.filter((s) => s === "rich").length;
  const cheapCount = states.filter((s) => s === "cheap").length;

  // Majority wins; ties resolve to "fair"
  let marketBadge: "cheap" | "fair" | "rich" = "fair";
  if (richCount  > states.length / 2) marketBadge = "rich";
  if (cheapCount > states.length / 2) marketBadge = "cheap";

  // ── Credit spread proxies ─────────────────────────────────────────────────
  // Yield spread = HY yield − IG yield (directional proxy for credit risk appetite)
  const hygYield = creditYields["HYG"];
  const lqdYield = creditYields["LQD"];
  const hyIgSpread =
    hygYield != null && lqdYield != null ? hygYield - lqdYield : null;

  // ── Console log ───────────────────────────────────────────────────────────
  console.log("\n══ MarketLens /api/valuation ══════════════════════════");
  for (const e of equityValuations) {
    const pe   = e.trailingPE   != null ? `PE=${e.trailingPE.toFixed(1)}` : "PE=—";
    const yld  = e.distributionYield != null
      ? `yield=${(e.distributionYield * 100).toFixed(2)}%` : "yield=—";
    const icon = e.badge === "cheap" ? "🟢" : e.badge === "rich" ? "🔴" : e.badge === "fair" ? "🟡" : "⚪";
    console.log(`  ${icon} ${e.ticker.padEnd(5)} ${pe.padEnd(12)} ${yld.padEnd(12)} [${e.badge}]`);
  }
  console.log("\n  Credit ETF yields:");
  for (const [t, y] of Object.entries(creditYields)) {
    console.log(`    ${t.padEnd(5)} ${y != null ? (y * 100).toFixed(2) + "%" : "—"}`);
  }
  console.log(`\n  HY-IG spread proxy: ${hyIgSpread != null ? (hyIgSpread * 100).toFixed(2) + "pp" : "—"}`);
  console.log(`  Market badge: ${marketBadge}`);
  console.log("══════════════════════════════════════════════════════\n");

  return NextResponse.json({
    asOf: new Date().toISOString(),
    equityValuations,
    creditYields: {
      LQD:  { yield: creditYields["LQD"],  label: "US Investment Grade (LQD)" },
      HYG:  { yield: creditYields["HYG"],  label: "US High Yield (HYG)" },
      EMB:  { yield: creditYields["EMB"],  label: "EM USD Sovereign (EMB)" },
      EMLC: { yield: creditYields["EMLC"], label: "EM Local Currency (EMLC)" },
    },
    derived: {
      hyIgSpreadProxy: hyIgSpread,
      marketBadge,
    },
    meta: {
      badgeThresholds: {
        "us-large":  { cheap: "<18x PE", fair: "18–27x", rich: ">27x" },
        "us-tech":   { cheap: "<25x PE", fair: "25–38x", rich: ">38x" },
        "us-small":  { cheap: "<14x PE", fair: "14–22x", rich: ">22x" },
        "intl-dm":   { cheap: "<13x PE", fair: "13–20x", rich: ">20x" },
        "em":        { cheap: "<12x PE", fair: "12–18x", rich: ">18x" },
      },
      notes: [
        "trailingPE and yield from Yahoo Finance quoteSummary (summaryDetail module)",
        "forwardPE not available for ETFs via Yahoo Finance — would require Bloomberg/Refinitiv",
        "HY-IG spread is yield differential (not OAS) — directional proxy only",
        "Credit implied yield is distribution yield, not SEC 30-day yield",
        "Badge is a directional signal; calibrated to post-GFC valuation ranges",
      ],
    },
  });
}
