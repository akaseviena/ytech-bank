import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { subMonths, startOfMonth } from "date-fns";
import { CATEGORY_INFO, type TransactionCategory } from "@/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DAILY_LIMIT = 50;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ── Aggregation helpers ──────────────────────────────────────────────────────

function buildTotals(
  txs: Array<{ amount: number | string; sender_id: string }>,
  userId: string,
) {
  const sent = txs.filter(t => t.sender_id === userId).reduce((s, t) => s + Number(t.amount), 0);
  const recv = txs.filter(t => t.sender_id !== userId).reduce((s, t) => s + Number(t.amount), 0);
  return { sent, recv };
}

function buildCatStr(
  txs: Array<{ amount: number | string; sender_id: string; category?: string | null }>,
  userId: string,
) {
  const cats: Partial<Record<TransactionCategory, number>> = {};
  txs.filter(t => t.sender_id === userId && t.category).forEach(t => {
    const c = t.category as TransactionCategory;
    cats[c] = (cats[c] ?? 0) + Number(t.amount);
  });
  if (Object.keys(cats).length === 0) return "None";
  return Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `${CATEGORY_INFO[cat as TransactionCategory]?.emoji ?? ""} ${cat}: £${Number(amt).toFixed(2)}`)
    .join(", ");
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // --- Daily usage check ---
  const today = new Date().toISOString().split("T")[0];
  const { data: usageRow } = await supabase
    .from("daily_usage")
    .select("message_count")
    .eq("user_id", user.id)
    .eq("usage_date", today)
    .maybeSingle();
  const currentCount = (usageRow?.message_count as number | null) ?? 0;
  if (currentCount >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "Daily limit reached.", limitReached: true },
      { status: 429 },
    );
  }
  // --- End daily usage check ---

  const { message, conversationHistory } = await request.json() as {
    message: string;
    conversationHistory: { role: "user" | "assistant"; content: string }[];
  };

  // Fetch user data — parallel queries across multiple time horizons
  const now = new Date();
  const twelveMonthsAgo = subMonths(now, 12).toISOString();

  const [profileRes, recentTxRes, longTermTxRes, allTimeTxRes, goalsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    // Last 30 individual transactions — detailed for line-item questions
    supabase
      .from("transactions")
      .select("amount, sender_id, category, description, created_at, type")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(30),
    // 12 months lightweight — for 1-month / 3-month / 12-month aggregates
    supabase
      .from("transactions")
      .select("amount, sender_id, category, created_at")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .gte("created_at", twelveMonthsAgo)
      .order("created_at", { ascending: false }),
    // All-time: 2 columns only, no limit — for lifetime totals and avg monthly spend
    supabase
      .from("transactions")
      .select("amount, sender_id")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
    supabase.from("savings_goals").select("*").eq("user_id", user.id),
  ]);

  const profile = profileRes.data;
  const recentTxs = recentTxRes.data ?? [];
  const longTermTxs = longTermTxRes.data ?? [];
  const allTimeTxs = allTimeTxRes.data ?? [];
  const goals = goalsRes.data ?? [];

  // Time-sliced subsets from the 12-month window
  const thisMonthStart = startOfMonth(now);
  const threeMonthsAgo = subMonths(now, 3);
  const thisMonthTxs = longTermTxs.filter(t => new Date(t.created_at) >= thisMonthStart);
  const threeMonthTxs = longTermTxs.filter(t => new Date(t.created_at) >= threeMonthsAgo);

  // Aggregate totals per window
  const thisMonthTotals = buildTotals(thisMonthTxs, user.id);
  const threeMonthTotals = buildTotals(threeMonthTxs, user.id);
  const twelveMonthTotals = buildTotals(longTermTxs, user.id);
  const allTimeTotals = buildTotals(allTimeTxs, user.id);

  // Account age and avg monthly spend
  const accountCreatedAt = (profile as Record<string, unknown>)?.created_at as string | undefined;
  const accountCreated = accountCreatedAt ? new Date(accountCreatedAt) : null;
  const accountAgeMonths = accountCreated
    ? Math.round((now.getTime() - accountCreated.getTime()) / (1000 * 60 * 60 * 24 * 30.5))
    : null;
  const avgMonthlySpend = accountAgeMonths && accountAgeMonths > 0
    ? allTimeTotals.sent / accountAgeMonths
    : null;

  // Recent transaction detail string (last 30 individual items)
  const recentTxStr = recentTxs.map((t) => {
    const dir = t.sender_id === user.id ? "Sent" : "Received";
    return `${dir} £${Number(t.amount).toFixed(2)} (${t.category}${t.description ? " — " + t.description : ""})`;
  }).join("\n");

  const goalsStr = goals.length > 0
    ? goals.map((g) => `${g.emoji} ${g.name}: £${g.current_amount}/£${g.target_amount}`).join(", ")
    : "None";

  const systemPrompt = `You are a personal AI financial assistant for Y-tech. You are helpful, warm, and professional.
Respond in the user's language (detect from their message — English or Russian).
Always be specific and reference real numbers from the user's data.

User: ${profile?.first_name} ${profile?.last_name}
Balance: £${Number(profile?.balance ?? 0).toFixed(2)}
Plan: ${profile?.plan}${accountCreated ? `\nAccount since: ${accountCreated.toLocaleDateString("en-GB", { month: "long", year: "numeric" })} (${accountAgeMonths} months)` : ""}

THIS MONTH (${now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}):
Spent: £${thisMonthTotals.sent.toFixed(2)} | Received: £${thisMonthTotals.recv.toFixed(2)}
By category: ${buildCatStr(thisMonthTxs, user.id)}

LAST 3 MONTHS:
Spent: £${threeMonthTotals.sent.toFixed(2)} | Received: £${threeMonthTotals.recv.toFixed(2)}
By category: ${buildCatStr(threeMonthTxs, user.id)}

LAST 12 MONTHS:
Spent: £${twelveMonthTotals.sent.toFixed(2)} | Received: £${twelveMonthTotals.recv.toFixed(2)}
By category: ${buildCatStr(longTermTxs, user.id)}

ALL-TIME:
Total spent: £${allTimeTotals.sent.toFixed(2)} | Total received: £${allTimeTotals.recv.toFixed(2)}${avgMonthlySpend != null ? `\nAvg monthly spend: £${avgMonthlySpend.toFixed(2)}` : ""}

RECENT TRANSACTIONS (last 30 individual items):
${recentTxStr || "None"}

Savings goals: ${goalsStr}

Be encouraging and actionable. Never advise on external investments. Only discuss Y-tech services and the user's data.

Be concise. Answer directly without restating the question or adding preamble. Skip unnecessary pleasantries. Get to the point in the first sentence. Keep responses focused — 2-3 short paragraphs maximum unless the user explicitly asks for more detail or a comprehensive document/report.

Format your responses in plain, natural language without markdown syntax. Do NOT use asterisks for bold (**text**), hash symbols for headers (## Header), or markdown bullet dashes (- item) — use natural sentence flow or simple numbered lists with actual numbers (1. 2. 3.) instead. Write like you're talking to a colleague — clear, structured with short paragraphs, but in plain conversational text. Use line breaks between ideas instead of markdown headers. If you need emphasis, just write clearly rather than using bold formatting. Use emojis sparingly — at most 1-2 per response, only when they genuinely add clarity (e.g. a warning ⚠️ or a single relevant icon), never decoratively on every line or every bullet point.`;

  const history: Anthropic.Messages.MessageParam[] = (conversationHistory ?? []).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [...history, { role: "user", content: message }],
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  // Atomic increment — awaited so the write commits before the response returns.
  // Uses a SQL function: ON CONFLICT DO UPDATE SET message_count = message_count + 1
  const { data: rpcResult } = await supabase.rpc("increment_daily_usage", {
    p_user_id: user.id,
    p_date: today,
  });
  const newCount = (rpcResult as number | null) ?? currentCount + 1;

  return NextResponse.json({ reply, messagesUsed: newCount });
}
