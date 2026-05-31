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
  // Store as plain object — Upstash SDK serializes to JSON internally.
  // Do NOT JSON.stringify here: the SDK auto-deserializes on read, so
  // double-stringifying causes kvGet to receive an already-parsed object
  // and then fail on a second JSON.parse call.
  await redis.set(key, value, { ex: SNAPSHOT_TTL });
}

export async function kvGet<T = unknown>(key: SnapshotKey): Promise<T | null> {
  // Upstash SDK auto-deserializes the stored JSON — return directly.
  const value = await redis.get<T>(key);
  return value ?? null;
}

export async function kvSetTimestamp(): Promise<void> {
  await redis.set("snapshot:ts", new Date().toISOString(), { ex: SNAPSHOT_TTL });
}
