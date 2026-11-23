import { z } from "zod";
import { requireUser, admin } from "@/lib/mobile/auth";
import { continuationsLeft } from "@/lib/mobile/reply-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A saved conversation, handed back to the person who owns it, newest page
// first. Works for the main assistant and for NeuroOffice agents alike: both
// store their messages in ai_conversations under a conversation id.
//
// This is what the screen shows, so it is NOT limited like what is sent to the
// model. Nothing is cut: the whole conversation is reachable, a page at a time.
//
//   GET /api/mobile/ai/conversations/<id>?limit=30            -> the latest 30
//   GET /api/mobile/ai/conversations/<id>?limit=30&before=45  -> the 30 before #45
//
// Messages come back oldest-first within a page, each with its position in the
// conversation (`index`). An assistant reply that was cut short (connection lost, model
// failure, length limit, time limit) also carries `"truncated": true` and `"continuationsLeft"`
// (0, 1 or 2: how many more times it can be continued, see the `continueFrom` field of the chat
// and NeuroOffice requests); complete replies have neither key. `nextBefore` is the `before` for the next, older page,
// or null once the first message has been returned. Positions only grow as the
// conversation grows, so a cursor stays valid while new messages arrive.

//   DELETE /api/mobile/ai/conversations/<id>                -> 200 {"ok": true, "conversationId": "<id>"}
//
// DELETE removes the conversation, and with it every message in it: the messages are the `messages`
// column of the same row, there is nowhere else they are kept. It works for a main-assistant
// conversation and for a NeuroOffice agent's alike (it is by id). Someone else's id, an id that does
// not exist and an id that was already deleted all answer the same 404 as GET does, so the answer
// cannot be used to find out which ids exist. A second DELETE of the same id is therefore a 404:
// treat 404 as "it is gone". 400 for an id that is not a UUID, 401 without a signed-in user.
//
// DELETING WHILE A REPLY IS BEING WRITTEN (from this device or another) is safe: the route that writes
// the reply saves into the conversation as it goes, and a save into a conversation that is no longer
// there writes nothing (lib/mobile/conversation-store.ts, commit: only a request's first write, the
// question, may create it). The person waiting still gets the reply; it is just not kept. The web still
// turns its Delete button off while a reply is on its way, as a courtesy.

const idSchema = z.string().uuid();
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100),
  before: z.coerce.number().int().min(0).optional(),
});

type StoredMessage = { role: "user" | "assistant"; content: string; timestamp: string; truncated?: boolean; continuations?: number };

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Authentication required." }, { status: 401 });
  }

  const id = idSchema.safeParse(params.id);
  if (!id.success) {
    return Response.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }

  // The row is removed by id AND user_id, so what is asked of the database can only ever reach the
  // signed-in person's own; "select" brings back what was removed, and nothing removed is a 404.
  const { data, error } = await admin
    .from("ai_conversations")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    console.error("[mobile/conversations] delete failed:", error);
    return Response.json({ error: "upstream_error", message: "Could not delete the conversation." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return Response.json({ error: "not_found", message: "Conversation not found." }, { status: 404 });
  }

  return Response.json({ ok: true, conversationId: id.data });
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Authentication required." }, { status: 401 });
  }

  const id = idSchema.safeParse(params.id);
  const search = new URL(request.url).searchParams;
  const query = querySchema.safeParse({
    limit: search.get("limit") ?? 30,
    ...(search.has("before") ? { before: search.get("before") } : {}),
  });
  if (!id.success || !query.success) {
    return Response.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }

  // Ownership is decided here, by the signed-in user, and only here: the row is
  // looked up by id AND user_id. Someone else's conversation id, an id that does
  // not exist and an id that was deleted all answer the same 404, so the
  // response cannot be used to find out which ids exist.
  const { data, error } = await admin
    .from("ai_conversations")
    .select("messages, updated_at, agent_id")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[mobile/conversations] read failed:", error);
    return Response.json({ error: "upstream_error", message: "Could not load the conversation." }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "not_found", message: "Conversation not found." }, { status: 404 });
  }

  const all = Array.isArray(data.messages) ? (data.messages as StoredMessage[]) : [];
  const total = all.length;
  const end = Math.min(query.data.before ?? total, total);
  const start = Math.max(end - query.data.limit, 0);

  return Response.json({
    conversationId: id.data,
    agentId: data.agent_id ?? null,
    total,
    updatedAt: data.updated_at,
    messages: all.slice(start, end).map((m, i) => ({
      index: start + i,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      // only present on a reply that was cut short
      ...(m.truncated ? { truncated: true, continuationsLeft: continuationsLeft(m) } : {}),
    })),
    nextBefore: start > 0 ? start : null,
  });
}
