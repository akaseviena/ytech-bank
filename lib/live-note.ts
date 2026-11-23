// The one line put NEXT TO the person's question, on both surfaces and for all nine assistants and
// agents: the balance right now, and a statement that whatever was quoted earlier in the conversation is
// out of date. One function, so the web and the app cannot differ in what it says or in how the money is
// written.
//
// WHY IT EXISTS (the app learned it first, the web paid to learn it again): a long conversation in
// which the model has already quoted a balance pulls it to quote that one again, however the system
// prompt is worded; the system prompt had the right number and the model gave the old one from its own
// reply of three weeks before. A rule says what to do, the note sits beside the question and wins.
//
// WHERE IT GOES (the surfaces differ on purpose, the text does not):
//   - the app puts it in front of the person's message (withLiveNote, lib/mobile/financial-context.ts);
//     its conversation is not cached;
//   - the web puts it in its own content block AFTER the question, and the cache breakpoint stays on the
//     question: what is cached is the history up to and including the question, which is what the next
//     turn re-sends, so the note costs its own few tokens and nothing else. Put in front of the
//     question, or inside its block, it would change the cached bytes every turn.
//
// Nothing is stored: the conversation in the database keeps only the person's own text.
//
// Erasable TypeScript only (the "@/" imports are resolved by the app and by lib/test-support/alias-hooks.mjs).

import { formatPence } from "@/lib/money";
import { londonIso } from "@/lib/clock";

/** What a builder returns: `system` is the context for the system prompt, `live` the note ("" when there is no main account). */
export type ModelContext = { system: string; live: string };

/**
 * The last user turn of a web request: the question carrying the cache breakpoint, then the note as a
 * block of its own with none. One function for both web routes, so neither can put the note inside the
 * cached block by accident.
 */
export function webQuestion(text: string, note: string) {
  const blocks: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[] = [
    { type: "text", text, cache_control: { type: "ephemeral" } },
  ];
  if (note) blocks.push({ type: "text", text: note });
  return blocks;
}

export function liveNoteFor(now: Date, balanceMinor: number, currency: string): string {
  const amount = currency === "GBP" ? formatPence(balanceMinor) : (balanceMinor / 100).toFixed(2);
  return `[Server note, not written by the user. Right now (${londonIso(now)}): balance ${amount} ${currency}. Any balance, total or date quoted earlier in this conversation is out of date; this note and the context are current.]`;
}
