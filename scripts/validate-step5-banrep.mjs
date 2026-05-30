/**
 * Step 5 — Part 2: probe BanRep public API endpoints
 * BanRep exposes statistics through a REST-ish catalog.
 * We try multiple known endpoint patterns and log what works.
 */

const BASE = "https://www.banrep.gov.co";
const TOTORO = "https://totoro.banrep.gov.co";

async function tryFetch(url, label) {
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json, text/plain, */*", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const snippet = text.slice(0, 200).replace(/\n/g, " ");
    console.log(`  ${res.ok ? "✅" : "⚠️ "} [${res.status}] ${label}`);
    console.log(`       ${snippet}`);
    return { ok: res.ok, status: res.status, body: text };
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message.slice(0, 80)}`);
    return { ok: false };
  }
}

console.log("\n── BanRep API endpoint probes ───────────────────────────────\n");

// 1. BanRep generador de series — main statistics endpoint
await tryFetch(
  `${BASE}/es/estadisticas/generador-series-estadisticas`,
  "Series generator (HTML page)"
);

// 2. Known BanRep REST API for TRM
await tryFetch(
  `${BASE}/sites/default/files/paginas/consultaseriesgraficas.json?idSerie=1.1.SER_TRM_INDICADOR&fechaInicio=2024-01-01&fechaFin=2025-05-30`,
  "TRM series (known pattern 1)"
);

// 3. BanRep Open Data / datos.banrep
await tryFetch(
  `${BASE}/es/estadisticas/tasa-cambio-del-peso-colombiano-trm`,
  "TRM page"
);

// 4. BanRep totoro analytics API
await tryFetch(
  `${TOTORO}/analytics/saw.dll?Go&path=%2Fshared%2FSIIDCO-Publico%2FinformesGraficos%2FserieHistorica&Action=Navigate`,
  "Totoro analytics (historical series)"
);

// 5. BanRep public data API (newer endpoint pattern)
await tryFetch(
  `${BASE}/api/estadisticas/serie?idSerie=1.1.SER_TRM_INDICADOR&fechaInicio=2025-01-01&fechaFin=2025-05-30`,
  "BanRep /api/estadisticas/serie TRM"
);

// 6. serieshistoricas endpoint (documented in some BanRep guides)
await tryFetch(
  `${BASE}/es/estadisticas/serieshistoricas?idCat=101&secuencia=1`,
  "serieshistoricas TRM"
);

// 7. Try BanRep's newer stats portal
await tryFetch(
  `https://www.banrep.gov.co/es/estadisticas/tasa-intervencion-politica-monetaria`,
  "BanRep policy rate page"
);

// 8. BanRep data API (try v1)
await tryFetch(
  `${BASE}/api/v1/series/1.1.SER_TRM_INDICADOR?fechaInicio=2025-01-01&fechaFin=2025-05-30`,
  "BanRep API v1 pattern"
);

console.log("\n── Also trying BanRep seriesCsv export ──────────────────────\n");
await tryFetch(
  `${BASE}/sites/default/files/paginas/tasa_cambio_diaria_usd_cop.csv`,
  "TRM CSV export"
);

console.log();
