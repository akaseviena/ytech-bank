// Which conversation the web assistant opens, and what "New" does. One module, so the page and its
// test read the same rule.
//
// WHICH: the person's most recently updated main-assistant conversation, wherever it was written (the
// web and the app share the table). Not the one a browser happens to remember: the page used to keep
// a conversation id in localStorage, so a second device opened its own, older thread and the newer
// one could not be reached from it at all, with no list and no way to see why.
//
// NEW: one more conversation. Nothing is deleted. (It used to delete the current one, behind a
// confirmation; in every other chat "new" means "another".) The empty row is made at once so that it
// is the newest: a reload then opens it, not the conversation just left. If that insert fails the
// page still switches to the new id and the server creates the row with the first message, as it
// always has.
//
// DELETE: a separate act with its own button and its own confirmation, never a side effect of "New".
// It removes exactly one main-assistant conversation of the person's own, so a mistaken id cannot
// reach a specialist's thread or anyone else's.
//
// Erasable TypeScript only, so `node --test` can run lib/web-conversation.test.mjs against this file.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface OpenedConversation {
  id: string;
  /** as saved: role, content, timestamp (and the app's bookkeeping, which the page does not show) */
  messages: unknown[];
}

/** `db` is the signed-in person's own client; row-level security limits it to their rows. */
export async function openLatestConversation(db: SupabaseClient, userId: string): Promise<OpenedConversation> {
  const { data } = await db
    .from("ai_conversations")
    .select("id, messages")
    .eq("user_id", userId)
    .is("agent_id", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.id) return { id: data.id as string, messages: Array.isArray(data.messages) ? (data.messages as unknown[]) : [] };
  // nothing saved yet: the server creates the row under this id with the first message
  return { id: crypto.randomUUID(), messages: [] };
}

/** "New": an empty conversation, made now. Returns its id. Deletes nothing. */
export async function startConversation(db: SupabaseClient, userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await db
    .from("ai_conversations")
    .insert({ id, user_id: userId, agent_id: null, messages: [], updated_at: new Date().toISOString() });
  if (error) console.warn("[web-conversation] could not create the empty conversation; the first message will:", error.message);
  return id;
}

/** "Delete this conversation": that one main-assistant conversation of this person. True when it is gone. */
export async function deleteConversation(db: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { error } = await db.from("ai_conversations").delete().eq("id", id).eq("user_id", userId).is("agent_id", null);
  if (error) console.warn("[web-conversation] could not delete the conversation:", error.message);
  return !error;
}
