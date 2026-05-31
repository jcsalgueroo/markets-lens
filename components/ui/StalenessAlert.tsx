"use client";

/**
 * StalenessAlert — client-side data freshness check.
 *
 * Computes the age of the most recent KV snapshot against the user's
 * local clock.  On weekdays (UTC), if the data is older than 26 hours
 * (the normal cron cadence is Mon–Fri 06:00 UTC), it shows an amber
 * warning so the user knows the morning refresh may have failed.
 *
 * Runs entirely client-side so it does not block the server render.
 * Hidden on weekends — stale data over a weekend is expected.
 * Hidden in print mode.
 */

import { useEffect, useState } from "react";

interface Props {
  asOf: string | null; // ISO timestamp from the KV snapshot
}

function ageLabel(asOf: string): string {
  const ms = Date.now() - new Date(asOf).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h ago`;
  if (h > 0)   return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

export function StalenessAlert({ asOf }: Props) {
  const [stale, setStale] = useState(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!asOf) return;

    const check = () => {
      const now = new Date();
      const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const isWeekday = utcDay >= 1 && utcDay <= 5;
      if (!isWeekday) return; // weekends: silence expected stale

      const ageMs = now.getTime() - new Date(asOf).getTime();
      const ageHours = ageMs / 3_600_000;

      // Cron runs at 06:00 UTC Mon–Fri.  Allow up to 26 h before alerting
      // (covers the 06:00→next-day 08:00 window with some slack).
      if (ageHours > 26) {
        setStale(true);
        setLabel(ageLabel(asOf));
      }
    };

    check();
    // Re-check every 10 min in case the user leaves the tab open overnight
    const id = setInterval(check, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [asOf]);

  if (!stale) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-500/20 bg-amber-500/5 print:hidden"
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-2 flex items-center gap-2">
        {/* Warning icon */}
        <svg
          className="w-3.5 h-3.5 text-amber-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <p className="text-amber-400 text-[11px] leading-relaxed">
          <span className="font-medium">Data may be stale</span>
          {label ? ` — last refresh ${label}.` : "."}
          {" "}The scheduled cron may have missed a run. Manually trigger{" "}
          <code className="text-amber-300 text-[10px] bg-amber-500/10 px-1 rounded">
            /api/cron/daily
          </code>{" "}
          to refresh.
        </p>
      </div>
    </div>
  );
}
