// Saving a conversation when more than one request may be writing to it.
//
// A conversation is one row whose `messages` column holds the whole list. Each request used
// to read it, add its own messages and write the whole list back, so two requests on one
// conversation (a second message sent while the first reply was still streaming, or two
// devices) overwrote each other: in the data, three requests in 11 seconds left one reply and
// one question out of five messages. Now every write is checked against the version it was
// based on (`updated_at`) and, when somebody else wrote in between, is made again on top of
// what they wrote. A request only ever puts its own messages in; it never writes back a list
// it read earlier.
//
// Messages as rows instead of one list would make this unnecessary; that is a schema change
// planned for after the beta (see the registry), and this is what runs until then.
//
// Dependency-free and erasable TypeScript so lib/mobile-reply.test.mjs can run it.

import type { StoredMessage } from "@/lib/mobile/reply-stream";

/** What one request has put into the conversation so far. Applied to whatever the row holds now. */
export interface Ours {
  /** names this request's messages in the list, so they are found again whatever else was added */
  rid: string;
  /** the question this request added (not for a continuation) */
  user?: StoredMessage;
  /** the answer so far */
  reply?: { text: string; cut: boolean; at: string };
  /**
   * This request extends an earlier cut reply instead of adding one. It finds that message by its
   * timestamp, and only goes ahead while the message's continuation count is `expect`, then sets
   * it to `set`.
   *
   * It is claimed first (`claimUntil`): the message is marked as being continued until then, and a
   * claim on a message that is marked and not yet lapsed is refused. So two taps on Continue, or
   * two devices, give one continuation, whichever reads the message first or last. The last write
   * of the continuation (`release`) takes the mark off; if the function is killed first, the
   * mark lapses at `claimUntil` and the reply can be continued again.
   */
  continuing?: { timestamp: string; baseContent: string; expect: number; set: number; claimUntil?: string; release?: boolean };
}

/**
 * The list with this request's messages put in, or null when a continuation can no longer be
 * made (the message is gone, or another request has taken it). Pure: the input is not changed.
 *
 * A question goes at the end; its answer goes right after it, so each question and answer stay
 * together however the requests interleave; an answer already put in is replaced in place.
 */
export function applyOurs(list: StoredMessage[], ours: Ours, nowMs: number = Date.now()): StoredMessage[] | null {
  const out = list.slice();

  if (ours.user && !out.some((m) => m.rid === ours.rid && m.role === "user")) {
    out.push({ ...ours.user, rid: ours.rid });
  }

  const c = ours.continuing;
  if (c) {
    const i = out.findIndex((m) => m.role === "assistant" && m.timestamp === c.timestamp);
    if (i < 0 || (out[i].continuations ?? 0) !== c.expect) return null;
    const { truncated: _was, continuations: _count, continuingUntil: marked, ...rest } = out[i];
    if (c.claimUntil && marked && Date.parse(marked) > nowMs) return null;
    const mark = c.claimUntil ?? (c.release ? undefined : marked);
    out[i] = {
      ...rest,
      content: c.baseContent + (ours.reply?.text ?? ""),
      ...(c.set > 0 ? { continuations: c.set } : {}),
      ...(mark ? { continuingUntil: mark } : {}),
      ...(ours.reply?.cut !== false ? { truncated: true as const } : {}),
    };
    return out;
  }

  if (ours.reply) {
    const reply: StoredMessage = {
      role: "assistant",
      content: ours.reply.text,
      timestamp: ours.reply.at,
      rid: ours.rid,
      ...(ours.reply.cut ? { truncated: true as const } : {}),
    };
    const own = out.findIndex((m) => m.rid === ours.rid && m.role === "assistant");
    if (own >= 0) out[own] = reply;
    else {
      const question = out.findIndex((m) => m.rid === ours.rid && m.role === "user");
      out.splice(question >= 0 ? question + 1 : out.length, 0, reply);
    }
  }
  return out;
}

/** A stamp later than the one it replaces, so that two writes never carry the same version. */
export function nextStamp(previous: string | null | undefined, now: Date): string {
  const before = previous ? Date.parse(previous) : 0;
  return new Date(Math.max(now.getTime(), (Number.isNaN(before) ? 0 : before) + 1)).toISOString();
}

export const SAVE_ATTEMPTS = 6;

export interface ConversationRef {
  id: string;
  userId: string;
  /** set for a NeuroOffice agent's conversation, absent for the main assistant's */
  agentId?: string;
}

/**
 * Put `ours` into the conversation: read, apply, write only if nobody wrote since, otherwise
 * read again. "superseded" means a continuation lost its place. Throws when the row stays too
 * busy, or the database fails.
 */
export async function commit(db: any, ref: ConversationRef, ours: Ours, now: () => Date = () => new Date()): Promise<"ok" | "superseded"> {
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
    const read = await db.from("ai_conversations").select("messages, updated_at").eq("id", ref.id).eq("user_id", ref.userId).maybeSingle();
    if (read.error) throw read.error;
    const row = read.data as { messages: StoredMessage[] | null; updated_at: string } | null;
    const stamp = nextStamp(row?.updated_at, now());

    const messages = applyOurs(row?.messages ?? [], ours, now().getTime());
    if (!messages) return "superseded";

    if (!row) {
      const created = await db.from("ai_conversations").insert({
        id: ref.id,
        user_id: ref.userId,
        ...(ref.agentId ? { agent_id: ref.agentId } : {}),
        messages,
        updated_at: stamp,
      });
      if (!created.error) return "ok";
      continue; // somebody created it first: read it and add to it
    }

    const written = await db.from("ai_conversations")
      .update({ messages, updated_at: stamp })
      .eq("id", ref.id)
      .eq("user_id", ref.userId)
      .eq("updated_at", row.updated_at)
      .select("id");
    if (written.error) throw written.error;
    if (written.data && written.data.length > 0) return "ok";
  }
  throw new Error("The conversation was being written to too often to save the reply.");
}
