import type { ValuationBadge } from "@/lib/types";

const BADGE_STYLES: Record<ValuationBadge, string> = {
  cheap:       "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  fair:        "bg-amber-500/15   text-amber-400   ring-1 ring-amber-500/30",
  rich:        "bg-rose-500/15    text-rose-400    ring-1 ring-rose-500/30",
  unavailable: "bg-slate-800      text-slate-500",
};

export function ValBadge({ badge }: { badge: ValuationBadge }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BADGE_STYLES[badge]}`}
    >
      {badge}
    </span>
  );
}
