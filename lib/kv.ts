/**
 * Vercel KV helpers for MarketLens snapshot cache.
 *
 * Keys follow the pattern  snapshot:<dataset>
 * TTL is 90 000 s (~25 h) so data survives even if a cron fires slightly late.
 */
import { kv } from "@vercel/kv";

const SNAPSHOT_TTL = 90_000; // seconds

export type SnapshotKey =
  | "snapshot:equities"
  | "snapshot:fixed-income"
  | "snapshot:commodities"
  | "snapshot:macro:colombia"
  | "snapshot:macro:global"
  | "snapshot:ts";

export async function kvSet(key: SnapshotKey, value: unknown): Promise<void> {
  await kv.set(key, JSON.stringify(value), { ex: SNAPSHOT_TTL });
}

export async function kvGet<T = unknown>(key: SnapshotKey): Promise<T | null> {
  const raw = await kv.get<string>(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetTimestamp(): Promise<void> {
  await kv.set("snapshot:ts", new Date().toISOString(), { ex: SNAPSHOT_TTL });
}
