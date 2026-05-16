import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { AGENT_PLAN_ACCESS, NEUROOFFICE_PLANS, type AgentType, type Plan, type TransactionCategory, CATEGORY_INFO } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  marketer: `You are an expert marketing strategist and content creator.
When given a business or marketing task, provide:
1. Content Plan: 3-5 content pillars with post ideas for Instagram, TikTok, and blog
2. Ad Campaign: copy for Google Ads and social media targeting, recommended budget allocation
3. Creative Ideas: 2-3 viral/unconventional campaign concepts
Format with clear sections and bullet points.`,

  copywriter: `You are a professional copywriter and content strategist.
Create or improve texts that are:
- Adapted to the target audience (formal for B2B, emotional for B2C)
- SEO optimized with natural keyword integration
- Structured with compelling headlines and subheadings
- Clear calls-to-action included
If improving text: fix errors, optimize headline, improve readability.`,

  "hr-manager": `You are an experienced HR manager and talent acquisition specialist.
For job postings: write compelling job descriptions emphasizing company culture, benefits, and growth opportunities.
For interviews: generate 10 relevant questions including behavioral, technical, and culture-fit questions with evaluation criteria.
For surveys: create 8-10 questions to measure employee sentiment with rating scales and open-ended questions.`,

  "client-manager": `You are an expert customer success and sales professional.
For reviews: write empathetic, professional responses that acknowledge feedback and offer solutions.
For sales scripts: create a natural conversation flow with opening, discovery questions, pitch, and close.
For objections: provide 3 different ways to handle the objection turning it into an opportunity.`,

  consultant: `You are a senior business consultant with expertise across multiple industries.
Provide structured analysis including:
1. Situation Assessment: key observations about the challenge
2. Root Causes: what's likely driving the issue
3. Recommendations: 3-5 specific, actionable strategies
4. Quick Wins: 2-3 things that can be implemented immediately
5. Long-term Strategy: 90-day roadmap
Be specific and data-driven where possible.`,

  designer: `You are a creative director and brand designer.
For logo briefs: provide detailed creative direction including concept, symbolism, color psychology, typography suggestions, and usage guidelines.
For banners/ads: provide exact specifications, layout description, copy placement, color scheme, and visual hierarchy.
For brand guidelines: create comprehensive brand identity document with voice, tone, colors, typography, and usage rules.`,

  lawyer: `You are a knowledgeable legal assistant.
For contracts: provide a detailed template with all standard clauses, clearly marking where customization is needed with [BRACKETS].
For risk analysis: identify potential legal risks in a described situation and suggest mitigation strategies.
For explanations: explain legal concepts in plain language with practical examples.
Always include a reminder to consult a licensed attorney.`,

  accountant: `You are an experienced accountant and financial advisor.
For tax planning: provide strategies to legally minimize tax burden, common deductions, and quarterly planning tips.
For cost optimization: analyze described expenses and suggest specific ways to reduce costs while maintaining quality.
For financial reports: analyze the provided transaction data and create a professional summary with income/expense breakdown, trends, and 3 specific recommendations.`,
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentType, input, tab, additionalInput, tone } = await request.json() as {
    agentType: AgentType;
    input: string;
    tab?: string;
    additionalInput?: string;
    tone?: string;
  };

  // Plan access check
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const plan = (profile?.plan ?? "basic") as Plan;

  if (!NEUROOFFICE_PLANS.includes(plan)) {
    return NextResponse.json({ error: "NeuroOffice is not available on your plan." }, { status: 403 });
  }

  const allowedAgents = AGENT_PLAN_ACCESS[plan] ?? [];
  if (!allowedAgents.includes(agentType)) {
    return NextResponse.json({ error: "This agent is not available on your plan." }, { status: 403 });
  }

  // Build user message
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

  // Accountant financial report — inject real transaction data
  if (agentType === "accountant" && tab === "financial-report") {
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount, sender_id, category, description, created_at")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: prof } = await supabase.from("profiles").select("balance, first_name, last_name").eq("id", user.id).single();
    const rows = txs ?? [];
    const sent = rows.filter((t) => t.sender_id === user.id);
    const received = rows.filter((t) => t.sender_id !== user.id);
    const totalSent = sent.reduce((s, t) => s + Number(t.amount), 0);
    const totalReceived = received.reduce((s, t) => s + Number(t.amount), 0);

    const catBreakdown: Partial<Record<TransactionCategory, number>> = {};
    sent.forEach((t) => {
      const c = t.category as TransactionCategory;
      catBreakdown[c] = (catBreakdown[c] ?? 0) + Number(t.amount);
    });
    const breakdown = Object.entries(catBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `${CATEGORY_INFO[cat as TransactionCategory]?.emoji} ${cat}: €${Number(amt).toFixed(2)}`)
      .join("\n");

    userMessage = `Generate a professional financial report for:
Name: ${prof?.first_name} ${prof?.last_name}
Current Balance: €${Number(prof?.balance ?? 0).toFixed(2)}
Total Spent (last 50 transactions): €${totalSent.toFixed(2)}
Total Received: €${totalReceived.toFixed(2)}
Net: €${(totalReceived - totalSent).toFixed(2)}

Spending by category:
${breakdown || "No spending data"}

Transaction count: ${rows.length} (${sent.length} sent, ${received.length} received)`;
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: SYSTEM_PROMPTS[agentType],
    messages: [{ role: "user", content: userMessage }],
  });

  const result = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ result });
}
