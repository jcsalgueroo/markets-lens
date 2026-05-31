/**
 * Upstash Redis helpers for MarketLens snapshot cache.
 *
 * Keys follow the pattern  snapshot:<dataset>
 * TTL is 90 000 s (~25 h) so data survives even if a cron fires slightly late.
 */
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const SNAPSHOT_TTL = 324_000; // seconds (90 h) — covers Friday→Monday weekend gap

export type SnapshotKey =
  | "snapshot:equities"
  | "snapshot:fixed-income"
  | "snapshot:commodities"
  | "snapshot:macro:colombia"
  | "snapshot:macro:global"
  | "snapshot:valuation"
  | "snapshot:ts";

export async function kvSet(key: SnapshotKey, value: unknown): Promise<void> {
  // Store as a JSON string. Upstash REST SDK returns strings as-is on get(),
  // so we control serialization explicitly here and parse explicitly in kvGet.
  await redis.set(key, JSON.stringify(value), { ex: SNAPSHOT_TTL });
}

export async function kvGet<T = unknown>(key: SnapshotKey): Promise<T | null> {
  // redis.get() returns whatever was stored. If kvSet stored a JSON string,
  // the SDK returns that string and we parse it. If somehow the SDK already
  // deserialized it to an object, we return it directly.
  const raw = await redis.get(key);
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  // Already an object (auto-deserialized by SDK in some configurations)
  return raw as T;
}

export async function kvSetTimestamp(): Promise<void> {
  await redis.set("snapshot:ts", new Date().toISOString(), { ex: SNAPSHOT_TTL });
}
