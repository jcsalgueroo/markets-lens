/**
 * Fetches Shiller CAPE (PE10) data directly from Robert Shiller's Yale dataset.
 * Used as fallback when the FRED "CAPE" series is unavailable or returns empty.
 *
 * Source: http://www.econ.yale.edu/~shiller/data/ie_data.xls
 * Data: Monthly S&P 500 CAPE ratio from 1881 onward.
 */

import * as XLSX from "xlsx";

export type ShillerObs = { date: string; value: number };

export async function fetchShillerCapeYale(): Promise<ShillerObs[]> {
  const url = "http://www.econ.yale.edu/~shiller/data/ie_data.xls";
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { "User-Agent": "MarketLens/1.0" },
  });
  if (!res.ok) throw new Error(`Yale Shiller XLS HTTP ${res.status}`);

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // The data sheet is typically named "Data"
  const sheetName = wb.SheetNames.includes("Data") ? "Data" : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("No usable sheet in Shiller workbook");

  // Parse as array-of-arrays; header:1 gives raw rows
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  // Locate the header row containing "P/E10" or "CAPE"
  let headerIdx = -1;
  let capeIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] as unknown[];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? "").trim().toUpperCase();
      if (cell === "P/E10" || cell === "CAPE" || cell === "PE10") {
        headerIdx = i;
        capeIdx = j;
        break;
      }
    }
    if (headerIdx >= 0) break;
  }
  if (capeIdx < 0) throw new Error("P/E10 / CAPE column not found in Shiller workbook");

  const result: ShillerObs[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const dateCell = row[0];
    const capeCell = row[capeIdx];
    if (dateCell == null || capeCell == null || capeCell === "") continue;

    // Date is stored as a decimal year: e.g. 1871.01 = Jan 1871, 2024.10 = Oct 2024
    const dateNum =
      typeof dateCell === "number" ? dateCell : parseFloat(String(dateCell));
    if (isNaN(dateNum) || dateNum < 1800 || dateNum > 2100) continue;

    const year = Math.floor(dateNum);
    // Floating-point: multiply and round to avoid 1871.01 → 0.9999 issue
    const month = Math.round((dateNum - year) * 100);
    if (month < 1 || month > 12) continue;

    const value =
      typeof capeCell === "number" ? capeCell : parseFloat(String(capeCell));
    if (isNaN(value) || value <= 0) continue;

    result.push({ date: `${year}-${String(month).padStart(2, "0")}-01`, value });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
