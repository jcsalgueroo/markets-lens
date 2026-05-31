import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

async function probeYale(url: string): Promise<{ status: number; pts: number; latest: string | null; bytes: number } | { error: string }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketLens/1.0)",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      cache: "no-store",
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames.includes("Data") ? "Data" : wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    let headerIdx = -1, capeIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i] as unknown[];
      if (String(row[0] ?? "").trim() !== "Date") continue;
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] ?? "").trim().toUpperCase();
        if (cell === "CAPE" || cell === "P/E10" || cell === "PE10") {
          headerIdx = i; capeIdx = j; break;
        }
      }
      break;
    }
    if (capeIdx < 0) return { error: "CAPE column not found", status: res.status, pts: 0, latest: null, bytes: buf.byteLength };

    const pts: { date: string; value: number }[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const dc = row[0]; const cc = row[capeIdx];
      if (dc == null || cc == null || cc === "") continue;
      const dn = typeof dc === "number" ? dc : parseFloat(String(dc));
      if (isNaN(dn) || dn < 1800 || dn > 2100) continue;
      const year = Math.floor(dn);
      const month = Math.round((dn - year) * 100);
      if (month < 1 || month > 12) continue;
      const val = typeof cc === "number" ? cc : parseFloat(String(cc));
      if (isNaN(val) || val <= 0) continue;
      pts.push({ date: `${year}-${String(month).padStart(2, "0")}-01`, value: val });
    }
    return { status: res.status, pts: pts.length, latest: pts.at(-1)?.date ?? null, bytes: buf.byteLength };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const ts = Date.now();
  const [xls, xlsx, xlsNocache] = await Promise.all([
    probeYale(`http://www.econ.yale.edu/~shiller/data/ie_data.xls`),
    probeYale(`http://www.econ.yale.edu/~shiller/data/ie_data.xlsx`),
    probeYale(`http://www.econ.yale.edu/~shiller/data/ie_data.xls?_=${ts}`),
  ]);
  return NextResponse.json({ xls, xlsx, xlsNocache }, { headers: { "Cache-Control": "no-store" } });
}
