import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { AGENT_PLAN_ACCESS, NEUROOFFICE_PLANS, type AgentType, type Plan, type TransactionCategory, CATEGORY_INFO } from "@/types";
import { subMonths, startOfMonth } from "date-fns";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DAILY_LIMIT = 50;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MAX_TOKENS: Record<AgentType, number> = {
  marketer: 2000,       // content plans & campaign copy need room
  copywriter: 2000,     // full text drafts
  "hr-manager": 1000,
  "client-manager": 1000,
  consultant: 1000,
  designer: 1000,
  lawyer: 2000,         // contract templates need room
  accountant: 1000,
};

const FORMATTING = `

Be concise. Answer directly without restating the question or adding preamble. Skip unnecessary pleasantries. Get to the point in the first sentence. Keep responses focused — 2-3 short paragraphs maximum unless the user explicitly asks for more detail or a comprehensive document/report.

Format your responses in plain, natural language without markdown syntax. Do NOT use asterisks for bold (**text**), hash symbols for headers (## Header), or markdown bullet dashes (- item) — use natural sentence flow or simple numbered lists with actual numbers (1. 2. 3.) instead. Write like you're talking to a colleague — clear, structured with short paragraphs, but in plain conversational text. Use line breaks between ideas instead of markdown headers. If you need emphasis, just write clearly rather than using bold formatting. Use emojis sparingly — at most 1-2 per response, only when they genuinely add clarity (e.g. a warning ⚠️ or a single relevant icon), never decoratively on every line or every bullet point.`;

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  marketer: `You are an expert marketing strategist and content creator.
When given a business or marketing task, provide a content plan with 3-5 content pillars and post ideas for Instagram, TikTok, and blog; ad campaign copy for Google Ads and social media targeting with recommended budget allocation; and 2-3 viral or unconventional campaign concepts.
Organise your response with short labelled paragraphs, not markdown headers or bullet dashes.` + FORMATTING,

  copywriter: `You are a professional copywriter and content strategist.
Create or improve texts adapted to the target audience (formal for B2B, emotional for B2C), SEO-optimised with natural keyword integration, structured with compelling headlines and subheadings, and clear calls-to-action.
If improving text: fix errors, optimise the headline, improve readability.
Deliver the output as flowing copy, not as a bulleted list of features.` + FORMATTING,

  "hr-manager": `You are an experienced HR manager and talent acquisition specialist.
For job postings: write compelling job descriptions emphasising company culture, benefits, and growth opportunities.
For interviews: generate 10 relevant questions including behavioural, technical, and culture-fit questions with evaluation criteria.
For surveys: create 8-10 questions to measure employee sentiment with rating scales and open-ended questions.
Present questions as a numbered list; use short paragraphs for explanatory text.` + FORMATTING,

  "client-manager": `You are an expert customer success and sales professional.
For reviews: write empathetic, professional responses that acknowledge feedback and offer solutions.
For sales scripts: create a natural conversation flow covering opening, discovery questions, pitch, and close.
For objections: provide 3 different ways to handle the objection and turn it into an opportunity.
Write scripts and responses as natural speech, not as bulleted talking points.` + FORMATTING,

  consultant: `You are a senior business consultant with expertise across multiple industries.
Provide structured analysis covering: a situation assessment with key observations about the challenge; root causes likely driving the issue; 3-5 specific, actionable recommendations; 2-3 quick wins that can be implemented immediately; and a 90-day roadmap as a long-term strategy.
Be specific and data-driven where possible. Use numbered sections and short paragraphs — no markdown headers or bullet dashes.` + FORMATTING,

  designer: `You are a creative director and brand designer.
For logo briefs: provide detailed creative direction including concept, symbolism, colour psychology, typography suggestions, and usage guidelines.
For banners and ads: provide exact specifications, layout description, copy placement, colour scheme, and visual hierarchy.
For brand guidelines: create a comprehensive brand identity document covering voice, tone, colours, typography, and usage rules.
Write in descriptive paragraphs; use numbered points only for specifications.` + FORMATTING,

  lawyer: `You are a knowledgeable legal assistant.
For contracts: provide a detailed template with all standard clauses, clearly marking where customisation is needed with [BRACKETS].
For risk analysis: identify potential legal risks in the described situation and suggest mitigation strategies.
For explanations: explain legal concepts in plain language with practical examples.
Always include a reminder to consult a licensed attorney.
Write in clear prose paragraphs; use numbered clauses only inside contract templates.` + FORMATTING,

  accountant: `You are an experienced accountant and financial advisor.
For tax planning: provide strategies to legally minimise tax burden, common deductions, and quarterly planning tips.
For cost optimisation: analyse the described expenses and suggest specific ways to reduce costs while maintaining quality.
For financial reports: analyse the provided transaction data and write a professional summary covering income and expense breakdown, trends, and 3 specific recommendations.
Present figures and recommendations in short numbered paragraphs, not in markdown tables or bullet lists.` + FORMATTING,
};

export async function POST(request: NextRequest) {
  console.log("[neurooffice] Request received");
  console.log("[neurooffice] API key exists:", !!process.env.ANTHROPIC_API_KEY);

  try {
    // 1. Auth
    console.log("[neurooffice] Initializing Supabase client...");
    const supabase = await createClient();

    console.log("[neurooffice] Getting user...");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) console.error("[neurooffice] Auth error:", authError);
    if (!user) {
      console.log("[neurooffice] No user — returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[neurooffice] User authenticated:", user.id);

    // 2. Parse body
    let body: {
      agentType: AgentType;
      input: string;
      tab?: string;
      additionalInput?: string;
      tone?: string;
      conversationHistory?: { role: "user" | "assistant"; content: string }[];
    };
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error("[neurooffice] Failed to parse request body:", parseErr);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { agentType, input, tab, additionalInput, tone, conversationHistory } = body;
    console.log("[neurooffice] agentType:", agentType, "tab:", tab, "historyLen:", conversationHistory?.length ?? 0);

    if (!agentType || !input) {
      return NextResponse.json({ error: "Missing agentType or input" }, { status: 400 });
    }

    // 3. Plan access check
    console.log("[neurooffice] Fetching profile for plan check...");
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (profileError) console.error("[neurooffice] Profile fetch error:", profileError);
    const plan = (profile?.plan ?? "basic") as Plan;
    console.log("[neurooffice] User plan:", plan);

    if (!NEUROOFFICE_PLANS.includes(plan)) {
      console.log("[neurooffice] Plan not eligible for NeuroOffice:", plan);
      return NextResponse.json({ error: "NeuroOffice is not available on your plan." }, { status: 403 });
    }

    const allowedAgents = AGENT_PLAN_ACCESS[plan] ?? [];
    if (!allowedAgents.includes(agentType)) {
      console.log("[neurooffice] Agent not allowed on plan:", agentType, plan);
      return NextResponse.json({ error: "This agent is not available on your plan." }, { status: 403 });
    }

    // 4. Daily usage check
    const today = new Date().toISOString().split("T")[0];
    const { data: usageRow } = await supabase
      .from("daily_usage")
      .select("message_count")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();
    const currentCount = (usageRow?.message_count as number | null) ?? 0;
    if (currentCount >= DAILY_LIMIT) {
      console.log("[neurooffice] Daily limit reached for user:", user.id);
      return NextResponse.json(
        { error: "Daily limit reached.", limitReached: true },
        { status: 429 },
      );
    }

    // 5. Build user message
    let userMessage = input;

    if (agentType === "copywriter" && additionalInput) {
      userMessage = `Original text to improve:\n${additionalInput}\n\nImprovement request: ${input}`;
    }
    if (agentType === "client-manager" && tab === "respond-to-review" && tone) {
      userMessage = `Customer review:\n${input}\n\nTone requested: ${tone}`;
    }
    if (tab) {
      userMessage = `Task type: ${tab}\n\n${userMessage}`;
    }

    // 6. Fetch financial context for all agents
    console.log("[neurooffice] Fetching financial context...");
    const monthStart = startOfMonth(new Date()).toISOString();

    const [profileRes, txRes, goalsRes, monthTxRes] = await Promise.all([
      supabase.from("profiles").select("balance, first_name, last_name, plan").eq("id", user.id).single(),
      supabase
        .from("transactions")
        .select("amount, sender_id, category, description, created_at, type")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("savings_goals").select("*").eq("user_id", user.id),
      supabase
        .from("transactions")
        .select("amount, sender_id, category")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .gte("created_at", monthStart),
    ]);

    const prof = profileRes.data;
    const txs = txRes.data ?? [];
    const goals = goalsRes.data ?? [];
    const monthTxs = monthTxRes.data ?? [];

    const monthlySent = monthTxs.filter((t) => t.sender_id === user.id);
    const monthlyReceived = monthTxs.filter((t) => t.sender_id !== user.id);
    const totalMonthlySent = monthlySent.reduce((s, t) => s + Number(t.amount), 0);
    const totalMonthlyReceived = monthlyReceived.reduce((s, t) => s + Number(t.amount), 0);

    const catBreakdown: Partial<Record<TransactionCategory, number>> = {};
    monthlySent.forEach((t) => {
      const c = t.category as TransactionCategory;
      catBreakdown[c] = (catBreakdown[c] ?? 0) + Number(t.amount);
    });
    const categoryBreakdown = Object.entries(catBreakdown).length > 0
      ? Object.entries(catBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => `  ${CATEGORY_INFO[cat as TransactionCategory]?.emoji ?? ""} ${cat}: £${Number(amt).toFixed(2)}`)
          .join("\n")
      : "  No spending this month";

    const recentTxList = txs.slice(0, 30).map((t) => {
      const dir = t.sender_id === user.id ? "Sent" : "Received";
      return `  ${dir} £${Number(t.amount).toFixed(2)} · ${t.category}${t.description ? " — " + t.description : ""}`;
    }).join("\n") || "  None";

    const goalsList = goals.length > 0
      ? goals.map((g) => `  ${g.emoji ?? "🎯"} ${g.name}: £${g.current_amount}/£${g.target_amount}`).join("\n")
      : "  None";

    const financialContext = `USER FINANCIAL CONTEXT:
Name: ${prof?.first_name ?? ""} ${prof?.last_name ?? ""}
Current balance: £${Number(prof?.balance ?? 0).toFixed(2)}
Plan: ${prof?.plan ?? plan}

This month:
- Total spent: £${totalMonthlySent.toFixed(2)}
- Total received: £${totalMonthlyReceived.toFixed(2)}

Spending by category this month:
${categoryBreakdown}

Recent transactions (last 30):
${recentTxList}

Savings goals:
${goalsList}

Use this data when relevant to give personalized advice.
---`;

    // 7. For accountant financial-report, override userMessage with structured prompt
    if (agentType === "accountant" && tab === "financial-report") {
      const allTxSent = txs.filter((t) => t.sender_id === user.id);
      const allTxReceived = txs.filter((t) => t.sender_id !== user.id);
      userMessage = `Generate a professional financial report.
Total Spent (last 30 transactions): £${allTxSent.reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
Total Received: £${allTxReceived.reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
Net: £${(allTxReceived.reduce((s, t) => s + Number(t.amount), 0) - allTxSent.reduce((s, t) => s + Number(t.amount), 0)).toFixed(2)}
Transaction count: ${txs.length}`;
    }

    // 8. Call Anthropic with financial context prepended to system prompt
    const history = (conversationHistory ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const systemPrompt = `${financialContext}\n\n${SYSTEM_PROMPTS[agentType]}`;

    console.log("[neurooffice] Calling Anthropic API, model: claude-sonnet-4-5-20250929, history:", history.length, "max_tokens:", MAX_TOKENS[agentType]);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: MAX_TOKENS[agentType],
      system: systemPrompt,
      messages: [...history, { role: "user", content: userMessage }],
    });

    console.log("[neurooffice] Anthropic response received, stop_reason:", response.stop_reason);

    const result = response.content[0]?.type === "text" ? response.content[0].text : "";

    // Increment usage counter (non-critical — fire and forget)
    const newCount = currentCount + 1;
    void supabase.from("daily_usage").upsert(
      { user_id: user.id, usage_date: today, message_count: newCount },
      { onConflict: "user_id,usage_date" },
    );

    return NextResponse.json({ result, messagesUsed: newCount });

  } catch (error: unknown) {
    const err = error as Error & { status?: number; error?: { message?: string } };
    console.error("[neurooffice] UNHANDLED ERROR:", err);
    console.error("[neurooffice] Error name:", err?.name);
    console.error("[neurooffice] Error message:", err?.message);
    console.error("[neurooffice] Error stack:", err?.stack);
    if (err?.status) console.error("[neurooffice] HTTP status from upstream:", err.status);
    if (err?.error) console.error("[neurooffice] Upstream error body:", err.error);

    return NextResponse.json(
      { error: err?.message ?? "Unknown error", name: err?.name ?? "Error" },
      { status: 500 }
    );
  }
}
