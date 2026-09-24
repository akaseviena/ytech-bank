import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireUser, admin } from "@/lib/mobile/auth";
import { encodeEvent, sseHeaders } from "@/lib/mobile/sse";
import { checkAiRateLimit, recordUsage } from "@/lib/mobile/rate-limit";
import { buildAgentContext, type MobileAgentId } from "@/lib/mobile/financial-context";
import { AGENT_PROMPTS } from "@/lib/mobile/prompts";
import type { Plan } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MOBILE_AGENT_IDS = [
  "consultant", "designer", "lawyer", "accountant",
  "marketer", "copywriter", "hr", "client_manager",
] as const;

// Plan gate — matches 07_SCREENS.md §6 and CLAUDE.md rule 10
const PLAN_AGENTS: Partial<Record<Plan, readonly MobileAgentId[]>> = {
  metal:    ["marketer", "copywriter", "consultant"],
  ultimate: MOBILE_AGENT_IDS,
  business: MOBILE_AGENT_IDS,
};
const PLANS_WITH_ACCESS = new Set<Plan>(["metal", "ultimate", "business"]);

const schema = z.object({
  agentId: z.enum(MOBILE_AGENT_IDS),
  input: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().nullable(),
});

type StoredMessage = { role: "user" | "assistant"; content: string; timestamp: string };

const STATUS_LABELS: Record<MobileAgentId, string[]> = {
  consultant:     ["Reading your financials…", "Analysing the situation…", "Building recommendations…"],
  designer:       ["Reading your budget…", "Crafting creative direction…"],
  lawyer:         ["Reading your budget…", "Reviewing legal context…"],
  accountant:     ["Reading your transactions…", "Running the numbers…"],
  marketer:       ["Reading your marketing spend…", "Building your campaign…"],
  copywriter:     ["Reading your budget…", "Crafting your copy…"],
  hr:             ["Reading your budget…", "Preparing the HR brief…"],
  client_manager: ["Reading your budget…", "Preparing client strategy…"],
};

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "Invalid request body." }, { status: 400 });
  }

  const { agentId, input } = parsed.data;

  const rl = await checkAiRateLimit(user.id);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", message: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // Plan gate — read from DB, never from request
  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan ?? "basic") as Plan;

  if (!PLANS_WITH_ACCESS.has(plan)) {
    return Response.json(
      { error: "plan_required", message: "NeuroOffice is available on Metal plan and above. Upgrade to continue." },
      { status: 403 },
    );
  }

  const allowedAgents = PLAN_AGENTS[plan] ?? [];
  if (!allowedAgents.includes(agentId)) {
    return Response.json(
      { error: "plan_required", message: `The ${agentId} agent requires an Ultimate or Business plan.` },
      { status: 403 },
    );
  }

  // Resolve or create conversation. A client-supplied conversationId is only
  // ever reused if it resolves to a row this user already owns — otherwise
  // (wrong owner, or it doesn't exist) mint a fresh id instead of trusting
  // it. The upsert below is keyed on `id`; reusing an unverified id would
  // let a caller silently adopt/overwrite another user's conversation row.
  let conversationId = parsed.data.conversationId;
  let storedMessages: StoredMessage[] = [];

  if (conversationId) {
    const { data } = await admin
      .from("ai_conversations")
      .select("messages")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();
    if (data) {
      storedMessages = (data.messages as StoredMessage[]) ?? [];
    } else {
      conversationId = crypto.randomUUID();
    }
  } else {
    conversationId = crypto.randomUUID();
  }

  const history = storedMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Persist user message before streaming
  const userTimestamp = new Date().toISOString();
  const updatedMessages: StoredMessage[] = [
    ...storedMessages,
    { role: "user", content: input, timestamp: userTimestamp },
  ];
  await admin.from("ai_conversations").upsert({
    id: conversationId,
    user_id: user.id,
    messages: updatedMessages,
    updated_at: userTimestamp,
  });

  // Build scoped context — GDPR data-minimisation per §3
  const agentContext = await buildAgentContext(user.id, agentId);

  const statusLabels = STATUS_LABELS[agentId];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enq = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(encodeEvent(event, data)));

      enq("meta", { conversationId });
      enq("status", { label: statusLabels[0] });

      let assistantText = "";

      try {
        const messageStream = anthropic.messages.stream({
          model: "claude-sonnet-5",
          max_tokens: 8192,
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
          system: [
            // Static agent prompt — cached between requests for this agent
            { type: "text", text: AGENT_PROMPTS[agentId], cache_control: { type: "ephemeral" } },
            // Volatile scoped context — after the cache breakpoint
            { type: "text", text: agentContext },
          ],
          messages: [...history, { role: "user", content: input }],
        });

        let statusIdx = 0;
        let tokensIn = 0;

        for await (const event of messageStream) {
          if (event.type === "content_block_start" && statusIdx + 1 < statusLabels.length) {
            statusIdx++;
            enq("status", { label: statusLabels[statusIdx] });
          }
          if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              assistantText += event.delta.text;
              enq("delta", { text: event.delta.text });
            }
            // Drop thinking_delta
          }
          if (event.type === "message_start") {
            tokensIn = event.message.usage?.input_tokens ?? 0;
          }
        }

        const finalMsg = await messageStream.finalMessage();
        const usage = finalMsg.usage;

        // Record usage
        await recordUsage(user.id, agentId, usage.input_tokens, usage.output_tokens);

        // Persist assistant response
        const assistantTimestamp = new Date().toISOString();
        const finalMessages: StoredMessage[] = [
          ...updatedMessages,
          { role: "assistant", content: assistantText, timestamp: assistantTimestamp },
        ];
        await admin.from("ai_conversations").update({
          messages: finalMessages,
          updated_at: assistantTimestamp,
        }).eq("id", conversationId).eq("user_id", user.id);

        enq("done", { stopReason: finalMsg.stop_reason });
        controller.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (assistantText) {
          const errorTimestamp = new Date().toISOString();
          const partialMessages: StoredMessage[] = [
            ...updatedMessages,
            { role: "assistant", content: assistantText, timestamp: errorTimestamp },
          ];
          try {
            await admin.from("ai_conversations").update({
              messages: partialMessages,
              updated_at: errorTimestamp,
            }).eq("id", conversationId).eq("user_id", user.id);
          } catch { /* best effort */ }
        }
        enq("error", { error: "upstream_error", message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}
