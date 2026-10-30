import { admin } from "./auth";
import { DAILY_LIMIT } from "@/lib/daily-limit";

// The same per-day AI message counter the web uses (table daily_usage, function
// increment_daily_usage), so a person's count and limit are one number across
// web and mobile. The day is a UTC day and resets at 00:00 UTC.

export interface DailyUsage {
  used: number;
  limit: number;
  /** next 00:00 UTC, formatted the way Postgres prints a timestamptz, e.g. "2026-10-31T00:00:00+00:00" */
  resetsAt: string;
}

/** "2026-10-30" — the UTC day, the key daily_usage is stored under. */
function utcDay(now: Date): string {
  return now.toISOString().split("T")[0];
}

/** The next midnight UTC. Midnight has no fractional seconds, so Postgres would print it exactly like this. */
export function nextResetAt(now: Date = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString().replace(".000Z", "+00:00");
}

/** Seconds until the counter resets — for a Retry-After header. */
export function secondsUntilReset(now: Date = new Date()): number {
  return Math.max(1, Math.ceil((Date.parse(nextResetAt(now)) - now.getTime()) / 1000));
}

export async function getDailyUsage(userId: string): Promise<DailyUsage> {
  const now = new Date();
  const { data, error } = await admin
    .from("daily_usage")
    .select("message_count")
    .eq("user_id", userId)
    .eq("usage_date", utcDay(now))
    .maybeSingle();
  if (error) console.error("[mobile/daily-usage] read failed:", error);
  return { used: (data?.message_count as number | null) ?? 0, limit: DAILY_LIMIT, resetsAt: nextResetAt(now) };
}

/**
 * Count one successful AI reply and return the new numbers. Never throws: a
 * failed write must not turn a delivered reply into an error, so it falls back
 * to the count read before the request, plus one.
 */
export async function recordDailyUse(userId: string, usedBefore: number): Promise<DailyUsage> {
  const now = new Date();
  const { data, error } = await admin.rpc("increment_daily_usage", { p_user_id: userId, p_date: utcDay(now) });
  if (error) console.error("[mobile/daily-usage] increment failed:", error);
  const used = typeof data === "number" ? data : usedBefore + 1;
  return { used, limit: DAILY_LIMIT, resetsAt: nextResetAt(now) };
}
