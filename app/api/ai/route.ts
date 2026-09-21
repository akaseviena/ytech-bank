import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { subMonths } from "date-fns";
import { CATEGORY_INFO, type TransactionCategory } from "@/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DAILY_LIMIT = 50;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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

  // Fetch user data
  const monthAgo = subMonths(new Date(), 1).toISOString();

  const [profileRes, txRes, goalsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("transactions")
      .select("amount, sender_id, category, description, created_at, type")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .gte("created_at", monthAgo)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("savings_goals").select("*").eq("user_id", user.id),
  ]);

  const profile = profileRes.data;
  const txs = txRes.data ?? [];
  const goals = goalsRes.data ?? [];

  const sent = txs.filter((t) => t.sender_id === user.id);
  const received = txs.filter((t) => t.sender_id !== user.id);
  const totalSent = sent.reduce((s, t) => s + Number(t.amount), 0);
  const totalReceived = received.reduce((s, t) => s + Number(t.amount), 0);

  const categoryBreakdown: Partial<Record<TransactionCategory, number>> = {};
  sent.forEach((t) => {
    const c = t.category as TransactionCategory;
    categoryBreakdown[c] = (categoryBreakdown[c] ?? 0) + Number(t.amount);
  });
  const breakdownStr = Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `${CATEGORY_INFO[cat as TransactionCategory]?.emoji ?? ""} ${cat}: £${Number(amt).toFixed(2)}`)
    .join(", ");

  const recentTxStr = txs.slice(0, 10).map((t) => {
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
Plan: ${profile?.plan}
Monthly spent: £${totalSent.toFixed(2)}
Monthly received: £${totalReceived.toFixed(2)}
Spending by category: ${breakdownStr || "No spending this month"}
Recent transactions:
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

  // Increment usage counter (non-critical — fire and forget)
  const newCount = currentCount + 1;
  void supabase.from("daily_usage").upsert(
    { user_id: user.id, usage_date: today, message_count: newCount },
    { onConflict: "user_id,usage_date" },
  );

  return NextResponse.json({ reply, messagesUsed: newCount });
}
