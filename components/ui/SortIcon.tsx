export type SortDir = "asc" | "desc" | null;

/** Compact inline sort-direction indicator shown next to column headers. */
export function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active) {
    return (
      <span className="ml-0.5 text-slate-700 text-[9px] select-none">↕</span>
    );
  }
  return (
    <span className="ml-0.5 text-sky-400 text-[9px] select-none">
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}
