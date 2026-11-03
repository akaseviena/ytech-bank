// How a streamed model reply is carried to the end, and what is saved of it on the way.
//
// Why this exists. A route has a time limit (`export const maxDuration`), and when the
// platform reaches it the function is killed on the spot: no `catch`, no `finally`, nothing
// after it runs. A long reply (a Marketer content plan takes 70 to 90 seconds) was cut off on
// the person's screen at the limit and left nothing behind: the question was saved before
// the stream, the answer only after it, so the answer was never saved, never counted, and
// the next "continue" reached the model with no reply in the history.
//
// So three things are done here, none of which depends on the process being allowed to finish:
//   1. The reply is stopped by us, a few seconds before the platform would stop it
//      (`budgetMs`), and ends the ordinary way: saved, marked `truncated`, counted, `done`.
//   2. While it streams, what has arrived is saved every CHECKPOINT_EVERY_MS, already
//      marked `truncated`, so even a killed function leaves what the person saw.
//   3. A reply that was cut short can be continued from where it stopped (`continuation*`).
//
// Dependency-free and erasable TypeScript so lib/reply-stream.test.mjs can run it.

/** How much of the route's time limit is kept back for saving and answering after we stop the model. */
export const SAFETY_MARGIN_S = 8;
/** At most this often is the reply so far written to the database while it streams. */
export const CHECKPOINT_EVERY_MS = 5_000;

/**
 * A saved message. `truncated` is set on an assistant reply that was cut short and absent on a
 * complete one. `continuations` is how many times a cut reply has been continued. `rid` names the
 * request that wrote the message (lib/mobile/conversation-store.ts); it is not sent to the app.
 */
export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  truncated?: true;
  continuations?: number;
  /** set while a continuation of this reply is being written; it lapses by itself if the function is killed */
  continuingUntil?: string;
  rid?: string;
};

/** A cut reply can be continued this many times. We cut it, not the person, so a continuation is not
 *  counted against the daily limit; the cap is what keeps its cost bounded. */
export const MAX_CONTINUATIONS = 2;

/** The stop reasons that mean "cut short, more could be written". `time_limit` is ours; `max_tokens` is the model's. */
export function isCut(stopReason: string): boolean {
  return stopReason === "max_tokens" || stopReason === "time_limit";
}

/** The seconds a route may spend before it stops the model, given its own `maxDuration`. */
export function budgetMsFor(maxDurationSeconds: number): number {
  return Math.max(1, maxDurationSeconds - SAFETY_MARGIN_S) * 1000;
}

// ── the stream ────────────────────────────────────────────────────────────────

/** The part of the Anthropic SDK's message stream that is used here. */
export interface ModelStream extends AsyncIterable<any> {
  abort(): void;
  finalMessage(): Promise<{ stop_reason: string | null; usage: { input_tokens: number; output_tokens: number } }>;
}

export interface ReplyResult {
  text: string;
  /** the model's stop reason, or "time_limit" when we stopped it */
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
}

/** The stream failed (or the person's connection went) after `partial` had arrived. */
export class ReplyFailed extends Error {
  partial: string;
  original: unknown;
  constructor(original: unknown, partial: string) {
    super(original instanceof Error ? original.message : String(original));
    this.original = original;
    this.partial = partial;
  }
}

export async function streamReply(opts: {
  open: () => ModelStream;
  /** `Date.now()` when the request began; the budget is counted from there, not from the stream */
  startedAt: number;
  budgetMs: number;
  /** each piece of text as it arrives; may throw (the person's connection is gone) */
  onText: (piece: string) => void;
  /** every event, for status lines */
  onEvent?: (event: any) => void;
  /** save the reply so far, marked cut. Failures are swallowed: a missed checkpoint must not end a reply. */
  checkpoint: (textSoFar: string) => Promise<void>;
}): Promise<ReplyResult> {
  const stream = opts.open();
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    stream.abort();
  }, Math.max(0, opts.budgetMs - (Date.now() - opts.startedAt)));
  let lastCheckpoint = Date.now();

  try {
    for await (const event of stream) {
      opts.onEvent?.(event);
      if (event.type === "message_start") {
        inputTokens = event.message?.usage?.input_tokens ?? 0;
      } else if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        text += event.delta.text;
        opts.onText(event.delta.text);
        if (Date.now() - lastCheckpoint >= CHECKPOINT_EVERY_MS) {
          lastCheckpoint = Date.now();
          try { await opts.checkpoint(text); } catch { /* best effort */ }
        }
      }
    }
    const final = await stream.finalMessage();
    return {
      text,
      stopReason: final.stop_reason ?? "end_turn",
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    };
  } catch (err) {
    if (timedOut) {
      // The model reports its output tokens only at the very end, so a reply we stopped has none;
      // about four characters to a token is a floor (thinking tokens are not visible here).
      return { text, stopReason: "time_limit", inputTokens, outputTokens: Math.ceil(text.length / 4) };
    }
    stream.abort(); // do not keep paying for a reply nobody is receiving
    throw new ReplyFailed(err, text);
  } finally {
    clearTimeout(timer);
  }
}

// ── continuing a cut reply ────────────────────────────────────────────────────

export interface ContinuationProblem {
  code: "not_continuable" | "continuation_limit";
  message: string;
}

/** Why the message at `index` cannot be continued, or null when it can. Only the latest message of a conversation can be. */
export function continuationProblem(stored: StoredMessage[], index: number): ContinuationProblem | null {
  const m = stored[index];
  if (!m) return { code: "not_continuable", message: "There is no such message in this conversation." };
  if (index !== stored.length - 1) return { code: "not_continuable", message: "Only the latest message of a conversation can be continued." };
  if (m.role !== "assistant" || !m.truncated) return { code: "not_continuable", message: "That reply is complete; there is nothing to continue." };
  if ((m.continuations ?? 0) >= MAX_CONTINUATIONS) {
    return { code: "continuation_limit", message: "This reply has already been continued twice. Ask for the rest in your own words." };
  }
  return null;
}

/** How many more times a cut reply can be continued. */
export function continuationsLeft(m: { continuations?: number }): number {
  return Math.max(0, MAX_CONTINUATIONS - (m.continuations ?? 0));
}

const TAIL_SHOWN = 200;

/**
 * The last turn the model is sent to continue a cut reply. It is written by the server, says
 * so, and is never saved: the conversation keeps only what the person and the model wrote.
 *
 * The point where the reply stopped is marked inside the quoted tail (⟫). Without the mark the
 * model guessed where the cut was: tried on a real Marketer plan, it repeated a heading
 * ("## 2. ## 2. …") and started a table over, where the marked form joined cleanly at a
 * half-written word, a table row, a heading and a line break.
 */
export function continuationNote(soFar: string): string {
  return (
    "[Server note, not written by the user. Your previous reply was cut off by a time or length limit while you were still writing. " +
    `The last characters you wrote are between ⟪ and ⟫, and ⟫ is the exact point where it stopped: ⟪${soFar.slice(-TAIL_SHOWN)}⟫. ` +
    "Write the continuation only. Your next characters are joined directly after that point, so begin with exactly the characters that would have come next " +
    "(finish a half-written word, heading, list item or table row first). Do not repeat anything already written, do not start over, " +
    "and add no apology, introduction or comment about the cut.]"
  );
}
