"use client";

import { useState, useEffect, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
  /** Short badge count or indicator shown next to label — optional */
  badge?: string;
}

interface TabNavProps {
  tabs: TabDef[];
  panels: Record<string, ReactNode>;
  defaultTab?: string;
}

export function TabNav({ tabs, panels, defaultTab }: TabNavProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  // Keyboard shortcuts: press 1–5 to jump to the corresponding tab.
  // Does not fire when focus is inside an input / textarea / select.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < tabs.length) {
        setActive(tabs[idx].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tabs]);

  return (
    <div>
      {/* Tab bar — hidden in print */}
      <div className="flex gap-1 border-b border-slate-800 px-4 md:px-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:hidden">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              title={`${tab.label} (press ${idx + 1})`}
              className={`
                flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 -mb-px whitespace-nowrap transition-colors
                ${
                  isActive
                    ? "border-sky-500 text-sky-400"
                    : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
                }
              `}
            >
              {tab.label}
              {tab.badge && (
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                    isActive
                      ? "bg-sky-500/20 text-sky-400"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
              {/* Keyboard shortcut hint — subtle, desktop only */}
              <span
                className={`
                  hidden md:inline-block text-[8px] tabular-nums rounded px-0.5
                  transition-colors
                  ${isActive ? "text-sky-600" : "text-slate-700"}
                `}
              >
                {idx + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panels — active panel shown on screen; ALL panels shown in print */}
      <div className="px-4 md:px-6 py-6 print:px-0 print:py-0">
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            // screen: hide non-active panels; print: show all
            className={`tab-panel-print ${tab.id === active ? "block" : "hidden print:block"}`}
          >
            {/* Print-only section heading + top padding */}
            <div className="hidden print:block print:pt-4 print:pb-2 section-card-print">
              <div className="flex items-center gap-3 mb-1">
                {idx > 0 && (
                  <div className="flex-1 border-t border-slate-700" />
                )}
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest whitespace-nowrap">
                  {tab.label}
                </h2>
                <div className="flex-1 border-t border-slate-700" />
              </div>
            </div>

            {/* Tab content — screen has normal padding, print strips it */}
            <div className="print:mt-2">
              {panels[tab.id]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
