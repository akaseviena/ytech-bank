import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";
import { CONTEXT_AGENTS, CONTEXT_FIELDS, TOTALS_WINDOW_RULE } from "./context-fields.ts";
import { clockProbe, writtenMark, dayLabel, dayBreaks, clockSection, londonDate, londonIso, monthLabel, monthStart, PRODUCT_TIME_ZONE } from "./clock.ts";

// The date is in every context, from one place, in one zone; "this month" is a named month whose
// boundary is that zone's; a transfer carries its date. The first tests are the clock itself, on the
// days where London and UTC disagree; the rest build every context on both surfaces.

register("./test-support/alias-hooks.mjs", import.meta.url);
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "clock-test-key";
const { buildAssistantContext, buildAgentContext } = await import("./mobile/financial-context.ts");
const { buildWebContext } = await import("./web-context.ts");

const at = (iso) => new Date(iso);

test("London is the zone, and it is the one the model is told", () => {
  assert.equal(PRODUCT_TIME_ZONE, "Europe/London");
  assert.match(clockSection(at("2026-11-22T14:05:09Z")), /Time zone: Europe\/London \(GMT, UTC\+00:00 today\)/);
  assert.match(clockSection(at("2026-07-15T10:00:00Z")), /Time zone: Europe\/London \(BST, UTC\+01:00 today\)/);
});

test("the date is London's date, not UTC's: half past eleven at night in UTC is already tomorrow in summer", () => {
  assert.equal(londonDate(at("2026-06-30T23:30:00Z")), "2026-07-01");
  assert.equal(londonDate(at("2026-12-31T23:30:00Z")), "2026-12-31");
  assert.equal(londonDate("2026-06-30T23:10:00+00:00"), "2026-07-01");
  assert.match(clockSection(at("2026-06-30T23:30:00Z")), /Today's date: Wednesday 1 July 2026 \(2026-07-01\)/);
  assert.match(clockSection(at("2026-11-22T14:05:09Z")), /Today's date: Sunday 22 November 2026 \(2026-11-22\)/);
});

test("the instant carries London's own offset", () => {
  assert.equal(londonIso(at("2026-11-22T14:05:09.987Z")), "2026-11-22T14:05:09+00:00");
  assert.equal(londonIso(at("2026-07-15T10:00:00Z")), "2026-07-15T11:00:00+01:00");
  // the hour the clocks go back is lived twice: 00:30 UTC is 01:30 BST, 01:30 UTC is 01:30 GMT
  assert.equal(londonIso(at("2026-10-25T00:30:00Z")), "2026-10-25T01:30:00+01:00");
  assert.equal(londonIso(at("2026-10-25T01:30:00Z")), "2026-10-25T01:30:00+00:00");
});

test("a month begins at London midnight on the 1st, summer or winter, and the label names it", () => {
  assert.equal(monthStart(at("2026-07-15T10:00:00Z")).toISOString(), "2026-06-30T23:00:00.000Z");
  assert.equal(monthStart(at("2026-11-22T14:00:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
  // an instant that is still June in UTC and already July in London belongs to July
  assert.equal(monthStart(at("2026-06-30T23:30:00Z")).toISOString(), "2026-06-30T23:00:00.000Z");
  assert.equal(monthLabel(at("2026-06-30T23:30:00Z")), "July 2026");
  // the month before, across a year and across the clock change
  assert.equal(monthStart(at("2027-01-10T12:00:00Z"), 1).toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(monthLabel(at("2027-01-10T12:00:00Z"), 1), "December 2026");
  assert.equal(monthStart(at("2026-11-22T12:00:00Z"), 1).toISOString(), "2026-09-30T23:00:00.000Z");
  assert.equal(monthLabel(at("2026-11-22T12:00:00Z"), 1), "October 2026");
  assert.equal(monthLabel(at("2027-01-10T12:00:00Z"), 13), "December 2025");
});

test("a chat's day headings are London's days: Today, Yesterday, then the full date", () => {
  const now = at("2026-11-22T10:03:00Z");
  assert.equal(dayLabel("2026-11-22T00:05:00Z", now), "Today");
  assert.equal(dayLabel("2026-11-21T23:59:00Z", now), "Yesterday");
  assert.equal(dayLabel("2026-11-20T17:53:38.531Z", now), "Friday 20 November 2026");
  assert.equal(dayLabel("2026-09-21T12:33:39.390Z", now), "Monday 21 September 2026");
  assert.equal(dayLabel(undefined, now), null);
  assert.equal(dayLabel("not a date", now), null);
  // across a month and a year
  assert.equal(dayLabel("2026-12-31T12:00:00Z", at("2027-01-01T12:00:00Z")), "Yesterday");
  // summer: 23:30 UTC on 30 June is 1 July in London, so for a reader at 08:00 UTC on 1 July it is Today, not Yesterday
  assert.equal(dayLabel("2026-06-30T23:30:00Z", at("2026-07-01T08:00:00Z")), "Today");
});

test("the same message has the same day in the heading the person sees and in the mark the assistant is told", () => {
  for (const iso of ["2026-06-30T23:30:00Z", "2026-11-20T17:53:38Z", "2026-03-29T00:30:00Z", "2026-10-25T00:30:00Z"]) {
    const mark = writtenMark(iso).match(/\d{4}-\d{2}-\d{2}/)[0];
    const label = dayLabel(iso, at("2030-01-01T00:00:00Z"));
    const [, d, month, y] = label.match(/(\d{1,2}) (\w+) (\d{4})/);
    const monthNo = String(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(month) + 1).padStart(2, "0");
    assert.equal(`${y}-${monthNo}-${d.padStart(2, "0")}`, mark, iso);
  }
});

test("a heading is above the first message of each day only; a message with no date shows none and does not split a day", () => {
  const now = at("2026-11-22T10:03:00Z");
  const messages = [
    { timestamp: "2026-11-20T17:53:38Z" },
    { timestamp: "2026-11-20T17:53:42Z" },
    {},
    { timestamp: "2026-11-20T17:59:00Z" },
    { timestamp: "2026-11-22T10:01:38Z" },
    { timestamp: "2026-11-22T10:02:41Z" },
  ];
  assert.deepEqual(dayBreaks(messages, now), ["Friday 20 November 2026", null, null, null, "Today", null]);
  // two messages the same UTC day, either side of London's midnight in summer: a new day starts between them
  assert.deepEqual(
    dayBreaks([{ timestamp: "2026-06-30T22:50:00Z" }, { timestamp: "2026-06-30T23:10:00Z" }], at("2026-07-10T10:00:00Z")),
    ["Tuesday 30 June 2026", "Wednesday 1 July 2026"],
  );
  assert.deepEqual(dayBreaks([{}, {}], now), [null, null], "a conversation saved before messages had dates shows no headings");
  assert.deepEqual(dayBreaks([], now), []);
});

test("the mark: London date of the message, nothing when there is none", () => {
  assert.equal(writtenMark("2026-11-20T17:53:38.531Z"), "[written 2026-11-20] ");
  assert.equal(writtenMark("2026-06-30T23:30:00Z"), "[written 2026-07-01] ");
  assert.equal(writtenMark(undefined), "");
  assert.equal(writtenMark("garbage"), "");
});

test("the section explains the marks: the date of a message is the day it was written, never today's date, and a model does not write one", () => {
  const s = clockSection(at("2026-11-22T14:05:09Z"));
  assert.match(s, /begin with a mark such as \[written 2026-11-20\]: the date they were written, added by the server/);
  assert.match(s, /means that date, not today/);
  assert.match(s, /Never take a date from an earlier message as today's date, even one you agreed to then/);
  assert.match(s, /no mark was written on an unknown date, except the user's latest one/);
  assert.match(s, /Never write such a mark yourself/);
});

test("the section tells the model the date comes from the server, and what to do with a date the user states", () => {
  const s = clockSection(at("2026-11-22T14:05:09Z"));
  assert.match(s, /source of truth/);
  assert.match(s, /If the user states or implies a different current date/);
  assert.match(s, /do not accept it and do not calculate from it/);
  assert.match(s, /explicit hypothetical/);
  assert.match(s, /does not change today's date either/);
  assert.match(s, /The current month is November 2026\. The previous month was October 2026\./);
  // no time of day: the web contexts are cached together with the conversation, a moving clock would miss every turn
  assert.ok(!/14:05|T14/.test(s), "the section has no time of day");
  assert.equal(clockSection(at("2026-11-22T00:01:00Z")), clockSection(at("2026-11-22T23:59:00Z")), "the same bytes all day");
  assert.notEqual(clockSection(at("2026-11-22T12:00:00Z")), clockSection(at("2026-11-23T12:00:00Z")));
});

test("the probe reads the date back out of the text that is sent, and says so when it is not there", () => {
  const server = at("2026-11-22T10:03:00Z");
  // a context built for one day, probed by a server whose clock says another: the two differ in the line
  const sent = `USER FINANCIAL CONTEXT:\n${clockSection(at("2026-11-20T12:00:00Z"))}\nBalance: £1.00`;
  assert.equal(
    clockProbe(sent, server),
    `clock: sent="Friday 20 November 2026 (2026-11-20)." server=2026-11-22T10:03:00+00:00 commit=${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}`,
  );
  assert.match(clockProbe("USER FINANCIAL CONTEXT:\nBalance: £1.00", server), /sent="MISSING"/);
});

// ── every context, both surfaces ───────────────────────────────────────────

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  main: "22222222-2222-4222-8222-222222222222",
  other: "33333333-3333-4333-8333-333333333333",
  otherUser: "55555555-5555-4555-8555-555555555555",
};
const transfer = (n, o) => ({ id: `aaaaaaaa-0000-4000-8000-00000000000${n}`, status: "completed", rail: "internal", category: "food", ...o });

// NOW is in summer, just after the first of July in London. Two payments sit either side of London's
// midnight: 23:10 UTC on 30 June is 00:10 on 1 July here (July), 22:50 UTC is 23:50 on 30 June (June).
// A month counted by the server's own zone (UTC) puts both in June.
const NOW = at("2026-07-15T10:00:00Z");
const JUST_AFTER = "2026-06-30T23:10:00Z";
const JUST_BEFORE = "2026-06-30T22:50:00Z";

function seed() {
  return {
    account_balances: [{ account_id: ids.main, owner_id: ids.user, kind: "main", currency: "GBP", balance_minor: "1234500" }],
    accounts: [
      { id: ids.main, owner_id: ids.user, kind: "main" },
      { id: ids.other, owner_id: ids.otherUser, kind: "main" },
    ],
    profiles: [{ id: ids.user, plan: "metal" }],
    cards: [],
    transfers: [
      transfer(1, { from_account: ids.main, to_account: ids.other, amount_minor: "1100", created_at: JUST_AFTER }),
      transfer(2, { from_account: ids.main, to_account: ids.other, amount_minor: "2200", created_at: JUST_BEFORE }),
      transfer(3, { from_account: ids.main, to_account: ids.other, amount_minor: "3300", created_at: "2026-07-10T09:00:00Z" }),
      transfer(4, { from_account: ids.other, to_account: ids.main, amount_minor: "5000", category: "other", created_at: "2026-07-12T09:00:00Z" }),
    ],
    savings_goals: [],
  };
}

async function collect() {
  const out = [];
  for (const agent of CONTEXT_AGENTS) {
    const app = agent === "assistant" ? await buildAssistantContext(ids.user, fakeDb(seed()), NOW) : await buildAgentContext(ids.user, agent, fakeDb(seed()), NOW);
    out.push({ surface: "app", agent, text: `${app.system}\n${app.live}` });
    out.push({ surface: "web", agent, text: await buildWebContext(fakeDb(seed()), ids.user, agent, NOW) });
  }
  return out;
}
const contexts = await collect();
const label = (c) => `${c.surface}/${c.agent}`;

test("all nine, on both surfaces: the same date section, to the byte, and it is there whatever the agent is given", () => {
  assert.equal(contexts.length, 18);
  const section = clockSection(NOW);
  for (const c of contexts) {
    assert.equal(c.text.split(section).length - 1, 1, `${label(c)} carries the date section once`);
  }
  // even the agents that are given the balance alone
  assert.ok(contexts.filter((c) => CONTEXT_FIELDS[c.agent].join() === "balance").length === 10);
});

test("the date section comes before the figures it dates", () => {
  for (const c of contexts) {
    const at = c.text.indexOf("Today's date:");
    assert.ok(at >= 0, label(c));
    assert.ok(at < c.text.indexOf("Balance:"), `${label(c)}: before the balance`);
  }
});

test("the app says the instant in London's offset, the same zone as the date", () => {
  for (const c of contexts.filter((x) => x.surface === "app")) {
    assert.match(c.text, /As of: 2026-07-15T11:00:00\+01:00 /, label(c));
    assert.ok(!/2026-07-15T10:00:00/.test(c.text), `${label(c)}: no UTC instant left`);
  }
  assert.match(contexts.find((c) => c.surface === "app" && c.agent === "assistant").text, /Right now \(2026-07-15T11:00:00\+01:00\)/);
  // (the rule's own words mention "As of"; what the web must not carry is an actual instant)
  assert.ok(!contexts.some((c) => c.surface === "web" && /\d{2}:\d{2}:\d{2}/.test(c.text)), "the web contexts carry no time of day");
});

test("a month figure names its month; none is called just 'this month' or 'current month'", () => {
  for (const c of contexts) {
    const hasMonthFigures = CONTEXT_FIELDS[c.agent].some((f) => f.startsWith("month_"));
    const labelled = /(This month|THIS MONTH|Spending by category)[^\n]*\(July 2026[^\n]*\)/.test(c.text);
    assert.equal(labelled, hasMonthFigures, `${label(c)}: month figures labelled with July 2026`);
    assert.ok(!/current month\)/.test(c.text), `${label(c)}: "(current month)" is gone`);
  }
  for (const c of contexts.filter((x) => x.agent === "consultant")) {
    assert.match(c.text, /July 2026 up to today, against the whole of June 2026/, label(c));
  }
});

test("'this month' begins at London's midnight: the payment 10 minutes into 1 July is July's, the one 10 minutes before is not", () => {
  for (const c of contexts.filter((x) => x.agent === "assistant")) {
    // July: 11.00 + 33.00 = £44.00 sent (the £22.00 belongs to June); received £50.00
    assert.match(c.text, /Spent: £44\.00/, `${label(c)} spent`);
    assert.match(c.text, /Received: £50\.00/, `${label(c)} received`);
  }
  for (const c of contexts.filter((x) => x.agent === "consultant")) {
    assert.match(c.text, /Expenses: £44\.00 \(prev: £22\.00\)/, `${label(c)} this month against last`);
  }
});

test("each transfer the assistant is shown carries its London date, newest first", () => {
  for (const c of contexts.filter((x) => x.agent === "assistant")) {
    const lines = c.text.split("\n").filter((l) => /\d{4}-\d{2}-\d{2}[ ·]+(Sent|Received)/.test(l));
    assert.equal(lines.length, 4, `${label(c)}: four transfers, each dated`);
    const dates = lines.map((l) => l.match(/\d{4}-\d{2}-\d{2}/)[0]);
    assert.deepEqual(dates, ["2026-07-12", "2026-07-10", "2026-07-01", "2026-06-30"], `${label(c)}: London dates, newest first`);
    assert.match(c.text, /newest first — date, amount, direction and category/i, label(c));
  }
  // the agents that are not shown transfers are not shown their dates
  for (const c of contexts.filter((x) => x.agent !== "assistant")) assert.ok(!/\d{4}-\d{2}-\d{2}[ ·]+(Sent|Received)/.test(c.text), label(c));
});

test("the totals over the last 50 transfers say they are a count, not a period, right under their heading; no other context says it", () => {
  const rule = TOTALS_WINDOW_RULE;
  assert.match(rule, /not a calendar period/);
  assert.match(rule, /Never call them "this month", "recently" or any other period/);
  assert.match(rule, /the data does not cover it; do not estimate/);
  for (const c of contexts) {
    const has = CONTEXT_FIELDS[c.agent].includes("last_transfers_totals");
    assert.equal(c.text.split(rule).length - 1, has ? 1 : 0, `${label(c)}`);
    if (has) {
      const heading = c.text.search(/(TOTALS|Totals) \(last 50 transfers\):/);
      assert.ok(heading >= 0 && c.text.indexOf(rule) > heading && c.text.indexOf(rule) < c.text.indexOf("Income:"), `${label(c)}: between the heading and the first figure`);
    }
  }
  assert.deepEqual(contexts.filter((c) => c.text.includes(rule)).map(label), ["app/accountant", "web/accountant"]);
});

test("the table says the date is sent with each transfer, so the consent text can", async () => {
  const { CONTEXT_FIELD_TEXT } = await import("./context-fields.ts");
  assert.match(CONTEXT_FIELD_TEXT.recent_transfers, /the date, the amount/);
});

// ── the four routes ───────────────────────────────────────────────────────

test("each of the four AI routes puts a context from one of the two builders into the system prompt, and builds no date of its own", () => {
  const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const routes = {
    "app/api/ai/route.ts": /buildWebContext\(/,
    "app/api/neurooffice/route.ts": /buildWebContext\(/,
    "app/api/mobile/ai/chat/route.ts": /buildAssistantContext\(/,
    "app/api/mobile/ai/neurooffice/route.ts": /buildAgentContext\(/,
  };
  for (const [path, builder] of Object.entries(routes)) {
    const text = read(path);
    assert.match(text, builder, `${path} builds its context with the shared builder`);
    assert.ok(!/clockSection|toLocaleDateString|Today's date/.test(text), `${path} puts a date into the prompt itself`);
    assert.match(text, /clockProbe\(/, `${path} logs the date it sent`);
    // the window is built from messages WITH their dates: a route that leaves `at` out sends its history undated
    assert.match(text, /windowHistory\([\s\S]{0,260}?\bat: \w+\.timestamp/, `${path} gives windowHistory the date of each message`);
  }
  // the date section is put into a context in exactly the two builders, and nowhere else
  for (const [path, count] of [["lib/web-context.ts", 1], ["lib/mobile/financial-context.ts", 1]]) {
    assert.equal(read(path).split("clockSection(").length - 1, count, path);
  }
});

test("both web chats draw their day headings from dayBreaks, and neither works a day out in the browser's own zone", () => {
  for (const path of ["app/(dashboard)/ai-assistant/page.tsx", "components/neurooffice/AgentPageShell.tsx"]) {
    const text = fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(text, /dayBreaks\(messages\)/, path);
    assert.ok(!/toLocaleDateString|toDateString|Intl\.DateTimeFormat/.test(text), `${path} works out a date of its own`);
  }
});
