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
// THE LIST: the person's way back to a conversation they are not in: newest first, each as its date and
// the first line of its first message. The first message is read on the server side of the query
// (messages->0->>content), so a list of 30 is a couple of kilobytes, not every message of every thread.
// The app's conversations are the same rows and are in it, which is the point: two devices, one list.
// 30 is a known limit, not a loose end: "New" reuses an empty conversation instead of adding another,
// so the list grows only as fast as people really start conversations.
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

export const LIST_LIMIT = 30;
export const EMPTY_TITLE = "New conversation";
const TITLE_MAX = 70;

/** The first line of a first message, squashed and cut for a list. Never cuts an emoji in half. */
export function conversationTitle(first: string | null | undefined): string {
  const line = String(first ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .find((l) => l !== "");
  if (!line) return EMPTY_TITLE;
  const chars = Array.from(line);
  return chars.length > TITLE_MAX ? chars.slice(0, TITLE_MAX).join("").trimEnd() + "…" : line;
}

export interface ConversationListItem {
  id: string;
  /** when its last message was saved (ISO) */
  updatedAt: string;
  title: string;
  /** nothing in it yet */
  empty: boolean;
}

/** The newest LIST_LIMIT main conversations of this person, newest first. */
export async function listConversations(db: SupabaseClient, userId: string): Promise<ConversationListItem[] | null> {
  const { data, error } = await db
    .from("ai_conversations")
    .select("id, updated_at, first:messages->0->>content")
    .eq("user_id", userId)
    .is("agent_id", null)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error || !data) return null;
  return (data as unknown as { id: string; updated_at: string; first: string | null }[]).map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    title: conversationTitle(r.first),
    empty: r.first == null,
  }));
}

/** One of this person's main conversations, to show. null when it is not there (deleted on another device). */
export async function openConversation(db: SupabaseClient, userId: string, id: string): Promise<OpenedConversation | null> {
  const { data } = await db
    .from("ai_conversations")
    .select("id, messages")
    .eq("id", id)
    .eq("user_id", userId)
    .is("agent_id", null)
    .maybeSingle();
  if (!data?.id) return null;
  return { id: data.id as string, messages: Array.isArray(data.messages) ? (data.messages as unknown[]) : [] };
}

/**
 * "New": an empty conversation. Returns its id. Deletes nothing. If this person already has an empty one
 * (made by an earlier "New" and left unused) that one is brought to the top instead of making a second:
 * otherwise the list would fill with identical "New conversation" rows.
 */
export async function startConversation(db: SupabaseClient, userId: string): Promise<string> {
  try {
    const unused = (await listConversations(db, userId))?.find((c) => c.empty);
    if (unused) {
      const { error } = await db
        .from("ai_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", unused.id)
        .eq("user_id", userId)
        .is("agent_id", null);
      if (!error) return unused.id;
    }
  } catch {
    // reusing is a courtesy to the list; a failed look-up must not stop "New": make a fresh one
  }
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
