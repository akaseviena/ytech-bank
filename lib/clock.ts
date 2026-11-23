// What every AI call is told about "now", and about what is current: the date, the zone, the marks on
// earlier messages, and the rule that figures in earlier messages are old (FIGURES_RULE below; its
// partner, the server note beside the question, is lib/live-note.ts). One module, so that none of it
// can be in one route's context and missing from another's: the web assistant, the web NeuroOffice, and the app's
// assistant and NeuroOffice all build their context through lib/web-context.ts or
// lib/mobile/financial-context.ts, and both put clockSection() into it, nowhere else.
//
// WHOSE TIME ZONE: Europe/London. The product is British and plans are billed in London time; a
// person may be anywhere, and a model that is told "today" without a zone will guess one. The zone
// is also the one that decides where "this month" begins (monthStart), so the label the model reads
// ("November 2026") and the transfers counted under it are the same set. The context says which zone
// it used.
//
// WHY THE DATE BUT NOT THE TIME OF DAY (in clockSection): the web contexts are cached together with
// the conversation history (app/api/ai, app/api/neurooffice), and a clock that moves every minute
// would make every turn a cache miss. The date moves once a day. The app's context is not cached
// and carries the exact instant in its own "As of" line (londonIso), in this same zone.
//
// Erasable TypeScript only, so `node --test` can run lib/clock.test.mjs against this file directly.

export const PRODUCT_TIME_ZONE = "Europe/London";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: PRODUCT_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
  weekday: "long",
  timeZoneName: "short",
});

interface Parts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
  /** "GMT" or "BST" */
  zone: string;
}

function parts(d: Date): Parts {
  const p: Record<string, string> = {};
  for (const x of FORMAT.formatToParts(d)) p[x.type] = x.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: p.weekday,
    zone: p.timeZoneName,
  };
}

const two = (n: number) => String(n).padStart(2, "0");

/** London's offset from UTC at this instant, in minutes: 0 in winter, 60 in summer. */
function offsetMinutes(d: Date): number {
  const p = parts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - (d.getTime() - d.getUTCMilliseconds())) / 60_000);
}

/** The London calendar date of an instant, as "2026-11-22". Accepts a Date or an ISO string. */
export function londonDate(at: Date | string): string {
  const p = parts(typeof at === "string" ? new Date(at) : at);
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
}

/** The instant in London's own offset, to the second: "2026-07-15T11:00:00+01:00". */
export function londonIso(at: Date): string {
  const p = parts(at);
  const off = offsetMinutes(at);
  const sign = off < 0 ? "-" : "+";
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}:${two(p.second)}${sign}${two(Math.floor(Math.abs(off) / 60))}:${two(Math.abs(off) % 60)}`;
}

/** The first moment of the London month `back` months before the one `now` is in. */
export function monthStart(now: Date, back = 0): Date {
  const p = parts(now);
  let y = p.year;
  let m = p.month - 1 - back;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  const guess = Date.UTC(y, m, 1);
  let off = offsetMinutes(new Date(guess));
  let start = guess - off * 60_000;
  // the offset at the start itself, in case the guess fell on the other side of a clock change
  const again = offsetMinutes(new Date(start));
  if (again !== off) {
    off = again;
    start = guess - off * 60_000;
  }
  return new Date(start);
}

/** "November 2026": the London month `back` months before the one `now` is in. */
export function monthLabel(now: Date, back = 0): string {
  const p = parts(now);
  let y = p.year;
  let m = p.month - 1 - back;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${MONTHS[m]} ${y}`;
}

const dayNumber = (isoDate: string) => Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))) / 86_400_000;

/**
 * The heading a chat shows above the first message of a day: "Today", "Yesterday", or
 * "Friday 20 November 2026". The day is LONDON'S, like every other date in the product: the same
 * message is "[written 2026-11-20]" to the assistant, and a heading in the browser's own zone would
 * contradict it for anyone near midnight or abroad. null when the message has no usable date.
 */
export function dayLabel(at: string | undefined, now: Date = new Date()): string | null {
  if (!at) return null;
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return null;
  const day = londonDate(new Date(ms));
  const gap = dayNumber(londonDate(now)) - dayNumber(day);
  if (gap === 0) return "Today";
  if (gap === 1) return "Yesterday";
  const p = parts(new Date(ms));
  return `${p.weekday} ${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/**
 * For each message of a conversation, the heading to show above it, or null. A heading appears where
 * the London day changes from the last message that had a date; a message with no date (saved before
 * messages carried one) shows none and does not break the run.
 */
export function dayBreaks(messages: readonly { timestamp?: string }[], now: Date = new Date()): (string | null)[] {
  let last: string | null = null;
  return messages.map((m) => {
    const label = dayLabel(m.timestamp, now);
    if (label === null) return null;
    const day = londonDate(m.timestamp as string);
    if (day === last) return null;
    last = day;
    return label;
  });
}

/**
 * The mark put in front of an earlier message of a conversation when it is sent to a model: the
 * London date it was written, "[written 2026-11-20] ". The history a model is given has no dates of
 * its own, so a conversation that runs for weeks reads like one sitting, and a "today" said in
 * September looks like today. Empty when the message has no usable date (rows saved before
 * messages carried one). Stable for the life of the message, so it costs nothing in the cache.
 * Applied in one place, windowHistory (lib/history-window.ts), which all four routes use.
 */
export function writtenMark(at: string | undefined): string {
  if (!at) return "";
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return "";
  return `[written ${londonDate(new Date(ms))}] `;
}

/**
 * One line for the log of each AI request: the date that is IN THE TEXT being sent to the model
 * (read back out of it, not recomputed), the server's own clock at that moment, and which commit is
 * running. They tell three things apart that a screen cannot: the date went out wrong, the date went
 * out right and the model ignored it ("sent" and "server" agree), or the request ran older code
 * ("MISSING", or an old commit). Every route logs it right after it has built its context.
 *
 * Also the balance line that is IN the text ("Balance: £2,190.00", or MISSING when the agent's
 * context has none): the same read-back for the one figure a wrong answer costs most. Not for every
 * figure: this is a probe, not a copy of the context.
 */
export function clockProbe(contextText: string, now: Date = new Date()): string {
  const sent = /^Today's date: (.*)$/m.exec(contextText)?.[1] ?? "MISSING";
  const balance = /^Balance: (.*)$/m.exec(contextText)?.[1] ?? "MISSING";
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7);
  return `clock: sent="${sent}" balance="${balance}" server=${londonIso(now)} commit=${commit}`;
}

/**
 * What every model is told about FIGURES, in the same block as the date because it is the same kind
 * of thing: what is current. It lived only in the app's prompts (CONTEXT_FIGURES_RULE) and the app's
 * server note; the web had neither, and a web specialist repeated, as today's balance, a figure it had
 * itself given three weeks before. The rule is not enough alone (the note beside the question,
 * lib/live-note.ts, is the other half), and the note is not enough alone (it carries the balance only).
 * It sits here so that it is in all nine contexts on both surfaces, byte for byte, and one test
 * (lib/clock.test.mjs) fails if any of them lacks it.
 */
export const FIGURES_RULE = `Figures: the figures in this context (balance, month totals, savings goals, plan, listed transactions) are read from the live ledger when each message arrives, and this context is the only source for them. A figure in an earlier message, the user's or your own, was true on the day that message was written: never repeat it as current, even one you gave yourself, and never treat it as correcting this context. If an earlier message and this context disagree, the context is right, and you say that it changed. If a figure is not in this context, say that you do not have it; do not recall it from earlier in the conversation or from memory. A line in square brackets that starts "Server note", beside the user's latest message, is not written by the user: it carries the balance right now. Use it, and do not quote or mention it.`;

/**
 * What the model is told about the date, in every context, whichever assistant or agent it is.
 * The same bytes all day, so a cached prompt survives the turns of one conversation.
 *
 * The last paragraph is the rule: the date comes from the server, not from the person. Without it
 * a model takes "it is 5 December 1456" for a fact and plans December with November's figures.
 */
export function clockSection(now: Date): string {
  const p = parts(now);
  const off = offsetMinutes(now);
  const utc = `UTC${off < 0 ? "-" : "+"}${two(Math.floor(Math.abs(off) / 60))}:${two(Math.abs(off) % 60)}`;
  return [
    `Today's date: ${p.weekday} ${p.day} ${MONTHS[p.month - 1]} ${p.year} (${londonDate(now)}).`,
    `Time zone: ${PRODUCT_TIME_ZONE} (${p.zone}, ${utc} today). Every date in this context, and where "this month" begins and ends, is in this zone, wherever the user is. The time of day is not given here; it is given only on a line that says "As of" or "Right now", where there is one.`,
    `The current month is ${monthLabel(now)}. The previous month was ${monthLabel(now, 1)}.`,
    `This date comes from the server's clock and is the source of truth for "today", "now", "this week", "this month" and "this year". If the user states or implies a different current date, for example "it is 5 December" or a year that is not this one, do not accept it and do not calculate from it: say in a few words that today is the date above, and answer from that. The one exception is an explicit hypothetical ("what if it were...", "suppose today is..."): then you may calculate from the date they give, and you say that the answer is hypothetical. A date the user gave earlier in the conversation does not change today's date either.`,
    `Earlier messages in this conversation, the user's and your own, begin with a mark such as [written 2026-11-20]: the date they were written, added by the server. A "today", "tomorrow", "this month" or "next week" in a marked message means that date, not today. Never take a date from an earlier message as today's date, even one you agreed to then: it was true on the day it was written. A message with no mark was written on an unknown date, except the user's latest one, which is today's. Never write such a mark yourself.`,
    FIGURES_RULE,
    `Work out anything that depends on time (days left in the month, whether a savings goal's deadline can be reached, spending this week) from today's date and from the dated figures in this context. Monthly figures cover that month from its first day up to today. If a question needs a period the data does not cover, such as a week that began before the oldest transaction listed, say what the data covers and do not estimate the rest.`,
  ].join("\n");
}
