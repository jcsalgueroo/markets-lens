import { fmtPct, changeColor } from "@/lib/formatters";

interface ChangeChipProps {
  value: number | null | undefined;
  /** Values within ±threshold are colored neutral. Default 0.05 (5bp) */
  threshold?: number;
  decimals?: number;
  suffix?: string;
}

export function ChangeChip({
  value,
  threshold = 0.05,
  decimals = 2,
  suffix = "%",
}: ChangeChipProps) {
  if (value == null) {
    return <span className="text-slate-600 tabular-nums">—</span>;
  }
  const color = changeColor(value, threshold);
  const sign = value >= 0 ? "+" : "";
  return (
    <span className={`${color} tabular-nums`}>
      {sign}{value.toFixed(decimals)}{suffix}
    </span>
  );
}

/** Compact inline version used in the Key Metrics strip */
export function InlineChange({
  value,
  threshold = 0.05,
}: {
  value: number | null | undefined;
  threshold?: number;
}) {
  if (value == null) return null;
  const color = changeColor(value, threshold);
  return (
    <span className={`${color} text-[10px] tabular-nums ml-1`}>
      {fmtPct(value)}
    </span>
  );
}
