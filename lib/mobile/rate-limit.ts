import { admin } from "./auth";

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
}

// 30/min across all AI routes (chat + neurooffice) for a single user
export async function checkAiRateLimit(userId: string): Promise<RateLimitResult> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("agent", "transfer")
    .gte("created_at", since);

  if ((count ?? 0) >= 30) {
    return { ok: false, retryAfter: 60 };
  }
  return { ok: true, retryAfter: 0 };
}

// 10/min for transfers
export async function checkTransferRateLimit(userId: string): Promise<RateLimitResult> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("agent", "transfer")
    .gte("created_at", since);

  if ((count ?? 0) >= 10) {
    return { ok: false, retryAfter: 60 };
  }
  return { ok: true, retryAfter: 0 };
}

export async function recordUsage(
  userId: string,
  agent: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  await admin.from("ai_usage").insert({
    user_id: userId,
    agent,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
}

export async function recordTransfer(userId: string): Promise<void> {
  await admin.from("ai_usage").insert({
    user_id: userId,
    agent: "transfer",
    input_tokens: 0,
    output_tokens: 0,
  });
}
