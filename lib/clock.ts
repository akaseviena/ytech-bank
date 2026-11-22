// What every AI call is told about "now". One module, so that the date cannot be in one route's
// context and missing from another's: the web assistant, the web NeuroOffice, and the app's
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
    `Work out anything that depends on time (days left in the month, whether a savings goal's deadline can be reached, spending this week) from today's date and from the dated figures in this context. Monthly figures cover that month from its first day up to today. If a question needs a period the data does not cover, such as a week that began before the oldest transaction listed, say what the data covers and do not estimate the rest.`,
  ].join("\n");
}
