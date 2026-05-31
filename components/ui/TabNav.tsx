"use client";

import { useState, type ReactNode } from "react";

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

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-800 px-4 md:px-6 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
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
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div className="px-4 md:px-6 py-6">
        {tabs.map((tab) => (
          <div key={tab.id} className={tab.id === active ? "block" : "hidden"}>
            {panels[tab.id]}
          </div>
        ))}
      </div>
    </div>
  );
}
