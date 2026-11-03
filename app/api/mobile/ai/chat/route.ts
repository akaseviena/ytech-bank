import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireUser, admin } from "@/lib/mobile/auth";
import { getDailyUsage, recordDailyUse, secondsUntilReset } from "@/lib/mobile/daily-usage";
import { encodeEvent, sseHeaders } from "@/lib/mobile/sse";
import { checkAiRateLimit, recordUsage } from "@/lib/mobile/rate-limit";
import { buildAssistantContext, withLiveNote } from "@/lib/mobile/financial-context";
import { ASSISTANT_SYSTEM_PROMPT } from "@/lib/mobile/prompts";
import { windowHistory, ASSISTANT_HISTORY_WINDOW } from "@/lib/history-window";
import {
  budgetMsFor, continuationNote, continuationProblem, continuationsLeft, isCut, ReplyFailed, streamReply,
  type StoredMessage,
} from "@/lib/mobile/reply-stream";
import { commit } from "@/lib/mobile/conversation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fluid compute is on, so the default ceiling is 300 s; 150 is about twice the longest reply
// measured (89 s) and still short enough that a spinner is not mistaken for a fault. The time
// budget for a reply (lib/mobile/reply-stream.ts) is taken from this number.
export const maxDuration = 150;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// A request is either a new message (`message`) or a continuation of the reply that was cut
// short (`continueFrom`: the `index` of that message, as the conversation endpoint returns it).
// A continuation needs the conversation it belongs to and carries no text of the person's.
const schema = z
  .object({
    conversationId: z.string().uuid().nullable(),
    message: z.string().trim().min(1).max(4000).optional(),
    continueFrom: z.number().int().min(0).optional(),
  })
  .refine((b) => (b.message === undefined) !== (b.continueFrom === undefined), "send message or continueFrom, not both")
  .refine((b) => b.continueFrom === undefined || b.conversationId !== null, "continueFrom needs conversationId");

export async function POST(request: Request) {
  const startedAt = Date.now();
  const user = await requireUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "Invalid request body." }, { status: 400 });
  }

  const { message, continueFrom } = parsed.data;
  const continuing = continueFrom !== undefined;
  const rl = await checkAiRateLimit(user.id);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", message: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // Daily message limit, shared with the web (lib/daily-limit.ts). Checked before
  // anything is saved, so a refused request leaves no trace. A continuation is not held to
  // it: we cut that reply, not the person, and it is not counted (MAX_CONTINUATIONS caps it).
  const daily = await getDailyUsage(user.id);
  if (!continuing && daily.used >= daily.limit) {
    return Response.json(
      { error: "daily_limit", message: "Daily message limit reached.", ...daily },
      { status: 429, headers: { "Retry-After": String(secondsUntilReset()) } },
    );
  }

  // Resolve or create conversation. A client-supplied conversationId is only
  // ever reused if it resolves to a row this user already owns — otherwise
  // (wrong owner, or it doesn't exist) mint a fresh id instead of trusting
  // it. A continuation has nothing to mint: the conversation it names must be there.
  let conversationId = parsed.data.conversationId;
  let storedMessages: StoredMessage[] = [];

  if (conversationId) {
    const { data } = await admin
      .from("ai_conversations")
      .select("messages")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      // the main assistant has no agent: a conversation stamped with an agent
      // is not continued here — it falls through to a fresh id
      .is("agent_id", null)
      .single();
    if (data) {
      storedMessages = (data.messages as StoredMessage[]) ?? [];
    } else if (continuing) {
      return Response.json({ error: "not_found", message: "Conversation not found." }, { status: 404 });
    } else {
      conversationId = crypto.randomUUID();
    }
  } else {
    conversationId = crypto.randomUUID();
  }
  const convId: string = conversationId;

  // The reply being continued must be the cut one at the end of the conversation.
  if (continuing) {
    const problem = continuationProblem(storedMessages, continueFrom);
    if (problem) return Response.json({ error: problem.code, message: problem.message }, { status: 409 });
  }

  // What the model is sent is a window of the saved conversation (lib/history-window.ts);
  // the database keeps the whole conversation.
  const history = windowHistory(
    storedMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ASSISTANT_HISTORY_WINDOW,
  );

  // Everything this request writes goes through commit (lib/mobile/conversation-store.ts):
  // it adds this request's messages to the conversation as it is now, and never writes back a
  // list read earlier, so a second message or a second device cannot wipe them out.
  const rid = crypto.randomUUID();
  const ref = { id: convId, userId: user.id };
  const cutReply = continuing ? storedMessages[continueFrom] : null;
  const had = cutReply?.continuations ?? 0;
  // claim: take the cut reply (marked as being continued until this function would be stopped);
  // hold: a save while it streams; release: the last save, or the give-back, which takes the mark off
  const continuingAs = (expect: number, set: number, mode: "claim" | "hold" | "release") =>
    cutReply
      ? {
          timestamp: cutReply.timestamp,
          baseContent: cutReply.content,
          expect,
          set,
          ...(mode === "claim" ? { claimUntil: new Date(startedAt + (maxDuration + 5) * 1000).toISOString() } : {}),
          ...(mode === "release" ? { release: true } : {}),
        }
      : undefined;
  const question: StoredMessage | undefined = continuing ? undefined : { role: "user", content: message!, timestamp: new Date().toISOString() };

  // Persist the question (or take the continuation) before streaming. A continuation adds no
  // question: it claims the cut reply, so two taps on Continue give one continuation, not two.
  try {
    const first = await commit(admin, ref, {
      rid,
      user: question,
      continuing: continuingAs(had, had + 1, "claim"),
      reply: continuing ? { text: "", cut: true, at: new Date().toISOString() } : undefined,
    });
    if (first === "superseded") {
      return Response.json({ error: "not_continuable", message: "That reply is already being continued." }, { status: 409 });
    }
  } catch (err) {
    console.error("[mobile/chat] saving the question failed:", err);
    return Response.json({ error: "conversation_busy", message: "Could not save your message. Please try again." }, { status: 503 });
  }

  // The reply is saved while it streams, already marked cut, and again when it ends
  // (lib/mobile/reply-stream.ts): a function stopped by the platform runs nothing more.
  const save = async (text: string, cut: boolean, last = false) => {
    try {
      await commit(admin, ref, {
        rid,
        user: question,
        continuing: continuingAs(had + 1, had + 1, last ? "release" : "hold"),
        reply: { text, cut, at: new Date().toISOString() },
      });
    } catch (err) {
      console.error("[mobile/chat] saving the reply failed:", err);
    }
  };
  // Nothing came of the continuation: give back the one it took.
  const refund = async () => {
    try {
      await commit(admin, ref, { rid, continuing: continuingAs(had + 1, had, "release"), reply: { text: "", cut: true, at: new Date().toISOString() } });
    } catch { /* best effort */ }
  };

  // Build financial context (volatile — placed after the cached system prompt)
  const financialContext = await buildAssistantContext(user.id);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enq = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(encodeEvent(event, data)));

      enq("meta", { conversationId: convId, ...(continuing ? { continuedFrom: continueFrom } : {}) });
      enq("status", { label: "Analysing your finances…" });

      let reply = "";

      try {
        const outcome = await streamReply({
          startedAt,
          budgetMs: budgetMsFor(maxDuration),
          open: () =>
            anthropic.messages.stream({
              model: "claude-sonnet-5",
              max_tokens: 8192,
              thinking: { type: "adaptive" },
              output_config: { effort: "medium" },
              system: [
                { type: "text", text: ASSISTANT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
                { type: "text", text: financialContext.system },
              ],
              // the live balance goes in front of the question in this last turn only; what is
              // stored above is the person's own text. A continuation's last turn is the
              // server's note about the cut, and is not stored at all.
              messages: [
                ...history,
                {
                  role: "user",
                  content: withLiveNote(
                    financialContext.live,
                    continuing ? continuationNote(storedMessages[continueFrom].content) : message!,
                  ),
                },
              ],
            }),
          // reasoning (thinking_delta) is never put on the wire; only text pieces are sent
          onText: (piece) => enq("delta", { text: piece }),
          checkpoint: (text) => save(text, true),
        });
        reply = outcome.text;

        // Record usage
        await recordUsage(user.id, "chat", outcome.inputTokens, outcome.outputTokens);

        // Stopped before a single word: nothing to save or count, and the person is told why.
        if (outcome.stopReason === "time_limit" && outcome.text === "") {
          if (continuing) await refund();
          enq("error", { error: "time_limit", message: "The reply took too long to start and was stopped. Please try again." });
          controller.close();
          return;
        }

        // Persist assistant response (marked cut when the model or the time limit stopped it)
        const cut = isCut(outcome.stopReason);
        await save(outcome.text, cut, true);

        // Count a new reply and hand the figure back, so the screen's counter updates without a
        // second request. A continuation is not counted. `truncated` is what the Continue button
        // hangs on, `continuationsLeft` whether there is one more.
        const counts = continuing ? daily : await recordDailyUse(user.id, daily.used);
        enq("done", {
          stopReason: outcome.stopReason,
          truncated: cut,
          continuationsLeft: cut ? continuationsLeft({ continuations: continuing ? had + 1 : 0 }) : 0,
          ...counts,
        });
        controller.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Persist whatever was received before the error
        const partial = err instanceof ReplyFailed ? err.partial : reply;
        if (partial) {
          try { await save(partial, true, true); } catch { /* best effort */ }
        } else if (continuing) {
          await refund();
        }
        try { enq("error", { error: "upstream_error", message: msg }); } catch { /* the person's connection is gone */ }
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}
