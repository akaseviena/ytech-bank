// What part of a saved conversation is sent to the model.
//
// The database keeps every message and the screen shows every message. This only
// decides what goes into the next model request, because sending the whole
// conversation every turn makes each reply cost more than the one before.
//
//   - Only the last `window` saved messages are sent.
//   - An older assistant reply longer than OLD_REPLY_MAX_CHARS is shortened to
//     its first OLD_REPLY_MAX_CHARS characters, with a note saying so.
//   - The last KEEP_UNTOUCHED_TAIL messages are sent exactly as saved: the most
//     recent reply is what a follow-up ("make it shorter") refers to.
//   - The person's own messages are never shortened.
//
// `window` counts saved messages, not the one being sent now: with 12, the model
// sees up to 12 earlier messages plus the new one.
//
// Dependency-free and erasable TypeScript so lib/history-window.test.mjs can run it.

/** Earlier messages sent to the model for the main assistant. Independent questions. */
export const ASSISTANT_HISTORY_WINDOW = 12;
/** Earlier messages sent for NeuroOffice agents. The person revises a document with the
 *  agent round after round, and cutting the thread there breaks the work itself. */
export const AGENT_HISTORY_WINDOW = 20;

/** An older assistant reply longer than this is shortened when sent. */
export const OLD_REPLY_MAX_CHARS = 1500;
/** The most recent messages are never shortened. */
export const KEEP_UNTOUCHED_TAIL = 2;

export const SHORTENED_NOTE = "\n\n[The rest of this earlier reply is left out here to save space.]";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

function shorten(text: string): string {
  let cut = text.slice(0, OLD_REPLY_MAX_CHARS);
  // do not leave half of a surrogate pair (an emoji) at the cut
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut.trimEnd() + SHORTENED_NOTE;
}

/**
 * The messages to send, oldest first. Does not modify its input: shortened
 * replies are copies, so what is saved to the database is never touched.
 */
export function windowHistory(messages: Turn[], window: number): Turn[] {
  if (!Number.isInteger(window) || window < 1) throw new Error("windowHistory: window must be a positive integer");

  let slice = messages.slice(-window);
  // The model API wants the conversation to open with the person's message. If the
  // cut landed on an assistant reply (an odd number saved after a failed turn), drop it.
  while (slice.length > 0 && slice[0].role !== "user") slice = slice.slice(1);

  const firstUntouched = slice.length - KEEP_UNTOUCHED_TAIL;
  return slice.map((m, i) =>
    i < firstUntouched && m.role === "assistant" && m.content.length > OLD_REPLY_MAX_CHARS
      ? { role: m.role, content: shorten(m.content) }
      : { role: m.role, content: m.content },
  );
}
