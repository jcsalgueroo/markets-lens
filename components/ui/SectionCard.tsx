import { type ReactNode } from "react";

interface SectionCardProps {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, badge, children, className }: SectionCardProps) {
  return (
    <div
      className={`
        section-card-print
        bg-slate-900 border border-slate-800 rounded-xl
        overflow-hidden print:overflow-visible
        ${className ?? ""}
      `}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 print:py-2">
        <h2 className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
          {title}
        </h2>
        {badge && <div className="print:hidden">{badge}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
