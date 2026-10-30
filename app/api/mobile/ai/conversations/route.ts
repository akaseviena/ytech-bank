import { z } from "zod";
import { requireUser, admin } from "@/lib/mobile/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The signed-in person's conversations for one agent (or for the main
// assistant), newest first — how the app finds a conversation again after a
// restart or on a new device. Open one with GET /api/mobile/ai/conversations/<id>.
//
//   GET /api/mobile/ai/conversations?agentId=consultant   that agent's conversations
//   GET /api/mobile/ai/conversations?agentId=main         the main assistant's
//
// `agentId` is required, so "all of them" is never returned by accident.
// "main" is a reserved word, not an agent id.
//
// What "main" means: ai_conversations.agent_id is NULL for the main assistant,
// and also for the conversations written before the column existed (their
// origin is unknown, so they were not given a value). The main list therefore
// includes those old rows. An agent's list contains only conversations that
// were stamped with that agent.

const querySchema = z.object({
  agentId: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  limit: z.coerce.number().int().min(1).max(50),
});

type StoredMessage = { role?: string; content?: unknown };

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Authentication required." }, { status: 401 });
  }

  const search = new URL(request.url).searchParams;
  const query = querySchema.safeParse({
    agentId: search.get("agentId") ?? undefined,
    limit: search.get("limit") ?? 10,
  });
  if (!query.success) {
    return Response.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }
  const { agentId, limit } = query.data;

  // The owner is always the signed-in user; nothing in the query can widen that.
  let q = admin.from("ai_conversations").select("id, agent_id, messages, updated_at").eq("user_id", user.id);
  q = agentId === "main" ? q.is("agent_id", null) : q.eq("agent_id", agentId);
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(limit);

  if (error) {
    console.error("[mobile/conversations] list failed:", error);
    return Response.json({ error: "upstream_error", message: "Could not load conversations." }, { status: 500 });
  }

  return Response.json({
    conversations: (data ?? []).map((row) => {
      const messages = Array.isArray(row.messages) ? (row.messages as StoredMessage[]) : [];
      const last = messages[messages.length - 1];
      return {
        id: row.id,
        agentId: row.agent_id ?? null,
        updatedAt: row.updated_at,
        messageCount: messages.length,
        preview: typeof last?.content === "string" ? last.content.slice(0, 120) : "",
      };
    }),
  });
}
