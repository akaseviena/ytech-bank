import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireUser, admin } from "@/lib/mobile/auth";
import { encodeEvent, sseHeaders } from "@/lib/mobile/sse";
import { checkAiRateLimit, recordUsage } from "@/lib/mobile/rate-limit";
import { buildAssistantContext } from "@/lib/mobile/financial-context";
import { ASSISTANT_SYSTEM_PROMPT } from "@/lib/mobile/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const schema = z.object({
  conversationId: z.string().uuid().nullable(),
  message: z.string().trim().min(1).max(4000),
});

type StoredMessage = { role: "user" | "assistant"; content: string; timestamp: string };

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

  const { message } = parsed.data;
  const rl = await checkAiRateLimit(user.id);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", message: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
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

  // Build Anthropic history from stored messages
  const history = storedMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Persist user message before streaming
  const userTimestamp = new Date().toISOString();
  const updatedMessages: StoredMessage[] = [
    ...storedMessages,
    { role: "user", content: message, timestamp: userTimestamp },
  ];
  await admin.from("ai_conversations").upsert({
    id: conversationId,
    user_id: user.id,
    messages: updatedMessages,
    updated_at: userTimestamp,
  });

  // Build financial context (volatile — placed after the cached system prompt)
  const financialContext = await buildAssistantContext(user.id);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enq = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(encodeEvent(event, data)));

      enq("meta", { conversationId });
      enq("status", { label: "Analysing your finances…" });

      let assistantText = "";

      try {
        const messageStream = anthropic.messages.stream({
          model: "claude-sonnet-5",
          max_tokens: 8192,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          system: [
            { type: "text", text: ASSISTANT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
            { type: "text", text: financialContext },
          ],
          messages: [...history, { role: "user", content: message }],
        });

        for await (const event of messageStream) {
          if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              assistantText += event.delta.text;
              enq("delta", { text: event.delta.text });
            }
            // Drop thinking_delta — empty text anyway, never put reasoning on the wire
          }
        }

        const finalMsg = await messageStream.finalMessage();

        // Record usage
        const usage = finalMsg.usage;
        await recordUsage(user.id, "chat", usage.input_tokens, usage.output_tokens);

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
        // Persist whatever was received before the error
        if (assistantText) {
          try {
            const errorTimestamp = new Date().toISOString();
            const partialMessages: StoredMessage[] = [
              ...updatedMessages,
              { role: "assistant", content: assistantText, timestamp: errorTimestamp },
            ];
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
