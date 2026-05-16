import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { subMonths } from "date-fns";
import { CATEGORY_INFO, type TransactionCategory } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history } = await request.json() as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
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
    .map(([cat, amt]) => `${CATEGORY_INFO[cat as TransactionCategory]?.emoji ?? ""} ${cat}: €${Number(amt).toFixed(2)}`)
    .join(", ");

  const recentTxStr = txs.slice(0, 10).map((t) => {
    const dir = t.sender_id === user.id ? "Sent" : "Received";
    return `${dir} €${Number(t.amount).toFixed(2)} (${t.category}${t.description ? " — " + t.description : ""})`;
  }).join("\n");

  const goalsStr = goals.length > 0
    ? goals.map((g) => `${g.emoji} ${g.name}: €${g.current_amount}/€${g.target_amount}`).join(", ")
    : "None";

  const systemPrompt = `You are a personal AI financial assistant for Y-tech Bank. You are helpful, warm, and professional.
Respond in the user's language (detect from their message — English or Russian).
Always be specific and reference real numbers from the user's data.

User: ${profile?.first_name} ${profile?.last_name}
Balance: €${Number(profile?.balance ?? 0).toFixed(2)}
Plan: ${profile?.plan}
Monthly spent: €${totalSent.toFixed(2)}
Monthly received: €${totalReceived.toFixed(2)}
Spending by category: ${breakdownStr || "No spending this month"}
Recent transactions:
${recentTxStr || "None"}
Savings goals: ${goalsStr}

Keep responses concise (max 3 short paragraphs). Be encouraging and actionable.
Never advise on external investments. Only discuss Y-tech Bank services and the user's data.`;

  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: systemPrompt,
    messages,
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  // Save conversation
  const { data: existing } = await supabase
    .from("ai_conversations")
    .select("id, messages")
    .eq("user_id", user.id)
    .single();

  const updatedMessages = [
    ...((existing?.messages as { role: string; content: string; timestamp: string }[]) ?? []),
    { role: "user", content: message, timestamp: new Date().toISOString() },
    { role: "assistant", content: reply, timestamp: new Date().toISOString() },
  ].slice(-50);

  if (existing) {
    await supabase.from("ai_conversations").update({ messages: updatedMessages, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await supabase.from("ai_conversations").insert({ user_id: user.id, messages: updatedMessages });
  }

  return NextResponse.json({ reply });
}
