/**
 * Display formatting helpers for MarketLens dashboard.
 * All functions accept null/undefined and return "—" for missing data.
 */

/** Format a number as a signed percentage string: "+1.23%" or "-0.45%" */
export function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(decimals) + "%";
}

/** Format a number with thousands separators: "5,290.12" */
export function fmtNum(
  v: number | null | undefined,
  decimals = 2
): string {
  if (v == null) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format a yield/rate level: "4.445%" */
export function fmtYield(v: number | null | undefined, decimals = 3): string {
  if (v == null) return "—";
  return v.toFixed(decimals) + "%";
}

/** Format an ISO timestamp as "May 30, 2026, 06:00 UTC" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

/** Format an ISO date string as "May 30, 2026" */
export function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    // Handle ECB quarterly format "2024-Q4" → "Q4 2024"
    const qMatch = iso.match(/^(\d{4})-Q([1-4])$/);
    if (qMatch) return `Q${qMatch[2]} ${qMatch[1]}`;
    // Handle "2025-01-01" and "2025-01-01T00:00:00Z"
    const d = iso.length === 10 ? iso + "T12:00:00Z" : iso;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return iso; // last-resort fallback
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

/** Return a Tailwind text color class for a signed return value */
export function changeColor(
  v: number | null | undefined,
  threshold = 0.05
): string {
  if (v == null) return "text-slate-600";
  if (v > threshold) return "text-emerald-400";
  if (v < -threshold) return "text-rose-400";
  return "text-slate-400";
}
