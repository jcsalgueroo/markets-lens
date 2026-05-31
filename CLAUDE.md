# MarketLens — Codebase Guide

Professional macro dashboard for an ETF Specialist at BlackRock covering
institutional clients (AFPs, insurance companies, family offices, private
banks) in Colombia, Costa Rica, El Salvador, and Honduras.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 App Router (TypeScript) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts v3 |
| KV store | Upstash Redis via `@upstash/redis` |
| Blob store | Vercel Blob via `@vercel/blob` |
| Market data | yahoo-finance2 v3 |
| Macro data | FRED API (api.stlouisfed.org) |
| Colombia data | datos.gov.co (BanRep TRM), FRED/OECD |
| Deployment | Vercel (Pro plan for cron support) |

---

## Architecture

```
Browser → Next.js page (force-dynamic, SSR)
                ↓
          kvGet() reads snapshot from Upstash Redis
                ↓
          Renders dashboard instantly (no client fetches for main data)
                ↓
          Chart components fetch history blobs from Vercel Blob
          (useHistoryData hook, client-side, per-tab lazy)
```

### Data flow

```
Vercel Cron (Mon–Fri 06:00 UTC)
  └─ /api/cron/daily
       ├─ Calls all /api/* routes in sequence
       ├─ Writes snapshots → Upstash Redis (TTL 90h)
       └─ Extracts history → Vercel Blob (appends, keeps 3Y)

Vercel Cron (Sundays 05:00 UTC)
  └─ /api/cron/weekly
       └─ Fetches 3Y equity history → Vercel Blob
```

### Key files

```
app/
  page.tsx              — Dashboard (server component, force-dynamic)
  layout.tsx            — RootLayout + metadata/OG
  error.tsx             — React error boundary (retry UI)
  global-error.tsx      — Layout-level error fallback
  loading.tsx           — Skeleton while SSR completes
  not-found.tsx         — 404 page
  icon.svg              — SVG favicon

  api/
    equities/           — US broad + sectors + factors + intl
    fixed-income/       — Treasuries + credit ETFs + FRED curve/OAS
    commodities/        — Energy + metals + agriculture
    macro/colombia/     — TRM, TES 10Y, IBR, oil-in-COP
    macro/global/       — Fed, CPI, PCE, GDP, DXY, ECB, CAPE
    valuation/          — P/E multiples (yahoo quoteSummary)
    history/            — Blob read endpoint for chart components
    cron/daily/         — Orchestrates all daily refreshes
    cron/weekly/        — 3Y equity history refresh

lib/
  kv.ts                 — Upstash Redis helpers (kvGet/kvSet, TTL 90h)
  blob.ts               — Vercel Blob helpers (blobWriteHistory/Read)
  fred.ts               — FRED API helper (keyed JSON + CSV fallback)
  yahoo.ts              — yahoo-finance2 wrappers (historical + quotes)
  valuation.ts          — Yahoo quoteSummary for P/E and implied yields
  datos-gov.ts          — BanRep TRM official fixing (datos.gov.co)
  formatters.ts         — fmtNum, fmtDate, changeColor, etc.
  types.ts              — All TypeScript interfaces for snapshot data

components/
  charts/               — All Recharts-based history charts
    useHistoryData.ts   — Shared hook: fetches + parses blob data
  dashboard/            — Data panels (tables, spreads, signals)
  ui/                   — Shared UI primitives (SectionCard, TabNav, …)
```

---

## Environment Variables

See `.env.example` for the full list with descriptions.

| Variable | Source | Notes |
|----------|--------|-------|
| `KV_REST_API_URL` | Upstash integration | Auto-injected by Vercel |
| `KV_REST_API_TOKEN` | Upstash integration | Auto-injected by Vercel |
| `BLOB_READ_WRITE_TOKEN` | Blob integration | Auto-injected by Vercel |
| `FRED_API_KEY` | FRED account | Required in production |
| `CRON_SECRET` | Manual | Must match Vercel cron auth header |
| `NEXT_PUBLIC_APP_URL` | Manual | Optional; defaults to Vercel URL |

---

## Cron Schedule (`vercel.json`)

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/daily` | Mon–Fri 06:00 UTC | Full data refresh (all 6 datasets) |
| `/api/cron/weekly` | Sundays 05:00 UTC | 3Y equity history rebuild |

Both routes require `Authorization: Bearer <CRON_SECRET>` header.

To trigger manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/daily`

---

## Adding a New Data Source

1. **API route** (`app/api/my-source/route.ts`):
   - `export const maxDuration = 60`
   - Fetch data, return `NextResponse.json({...})`

2. **Type** (`lib/types.ts`):
   - Add `MySourceSnapshot` interface

3. **KV snapshot** (`app/api/cron/daily/route.ts`):
   - Add `["snapshot:my-source", "/api/my-source"]` to the `datasets` array

4. **Page** (`app/page.tsx`):
   - `kvGet<MySourceSnapshot>("snapshot:my-source")`
   - Pass data to a new tab or existing panel

5. **History** (optional):
   - Add extractor function in `cron/daily/route.ts`
   - Add to `historyTasks` array → written to Vercel Blob
   - Create a `useHistoryData("my-source")` chart component

---

## Common Maintenance Tasks

### Data is stale
1. Check Vercel → Functions → `/api/cron/daily` logs
2. Trigger manually: run `/api/cron/daily` in the Vercel dashboard
3. If FRED fails: check `FRED_API_KEY` is set in Vercel env vars

### Adding a new ticker
- Yahoo Finance tickers: update the registry in the relevant `/api/*` route
- FRED series: add to `FRED_TENORS` or `OAS_SERIES` in `fixed-income/route.ts`
- Also update the corresponding history extractor in `cron/daily/route.ts`

### Recharts TypeScript
- Tooltip `formatter` signature: `(value: unknown, name: unknown)` — not `string`
- Always cast: `const num = value as number; const key = String(name ?? "")`

### KV TTL
- Set to 90 hours (324,000s) — covers Friday data through Monday morning

### Print mode
- Toggle class: `print:hidden` / `print:block`
- Section break: add `section-card-print` class (CSS `break-inside: avoid`)
- Background colors in print: `print-color-adjust: exact` in `globals.css`

---

## FRED® Attribution

This product uses the FRED® API but is not endorsed or certified by the
Federal Reserve Bank of St. Louis.

Terms of Use: https://fred.stlouisfed.org/docs/api/terms_of_use.html

The attribution disclaimer is displayed in the application footer and
users are informed they are bound by the FRED® API Terms of Use.
