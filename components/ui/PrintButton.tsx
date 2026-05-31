"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-md transition-colors flex-shrink-0"
      title="Print or save as PDF"
    >
      {/* printer icon */}
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"
        />
      </svg>
      Print / PDF
    </button>
  );
}
