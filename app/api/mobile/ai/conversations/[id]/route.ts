import { z } from "zod";
import { requireUser, admin } from "@/lib/mobile/auth";

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
// conversation (`index`). `nextBefore` is the `before` for the next, older page,
// or null once the first message has been returned. Positions only grow as the
// conversation grows, so a cursor stays valid while new messages arrive.

const idSchema = z.string().uuid();
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100),
  before: z.coerce.number().int().min(0).optional(),
});

type StoredMessage = { role: "user" | "assistant"; content: string; timestamp: string };

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
    .select("messages, updated_at")
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
    total,
    updatedAt: data.updated_at,
    messages: all.slice(start, end).map((m, i) => ({
      index: start + i,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    })),
    nextBefore: start > 0 ? start : null,
  });
}
