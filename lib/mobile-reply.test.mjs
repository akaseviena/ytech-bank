import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

// The real POST handlers of the two mobile AI routes, run against a stand-in database and a
// scripted model (lib/test-support/route-hooks.mjs). What is under test is what happens to a
// reply that is long, cut short, or never finishes, and to a conversation that more than one
// request writes to: every reply ends up saved, marked, and continuable, nothing is lost to a
// second request, and a function that is stopped mid-reply has left what was shown.
//
// Time is the test's own: the model script advances a mock clock, so a reply that "takes
// 140 seconds" takes no time at all, and the route's time budget is the real one.

register("./test-support/alias-hooks.mjs", import.meta.url);
register("./test-support/route-hooks.mjs", import.meta.url);

const agentRoute = await import("../app/api/mobile/ai/neurooffice/route.ts");
const chatRoute = await import("../app/api/mobile/ai/chat/route.ts");
const conversationRoute = await import("../app/api/mobile/ai/conversations/[id]/route.ts");
const { continuationProblem, continuationNote, continuationsLeft, budgetMsFor, isCut, CHECKPOINT_EVERY_MS, MAX_CONTINUATIONS } = await import("./mobile/reply-stream.ts");
const { applyOurs, commit, nextStamp } = await import("./mobile/conversation-store.ts");
const { DAILY_LIMIT } = await import("./daily-limit.ts");

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const OTHER = "99999999-9999-4999-8999-999999999999";
const MAIN = "22222222-2222-4222-8222-222222222222";
const CONV = "33333333-3333-4333-8333-333333333333";
const T0 = 1_700_000_000_000;
const TODAY = new Date(T0).toISOString().split("T")[0];
/** a model that never stops is stopped by the route at its own budget, which is this far away */
const RUNS_OUT = 200_000;

const stamp = (n) => new Date(T0 - 1000 * n).toISOString();
const user = (content, n = 10) => ({ role: "user", content, timestamp: stamp(n) });
const asst = (content, n = 9, extra = {}) => ({ role: "assistant", content, timestamp: stamp(n), ...extra });
const cutAsst = (content, n = 9, continuations = 0) => asst(content, n, { truncated: true, ...(continuations ? { continuations } : {}) });
const row = (messages, agent = "marketer", owner = USER.id) => ({ id: CONV, user_id: owner, agent_id: agent, messages, updated_at: stamp(1) });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

// ── the scripted model ────────────────────────────────────────────────────────

const abortError = () => Object.assign(new Error("Request was aborted."), { name: "APIUserAbortError" });

/** steps: {start} | {text} | {tick: ms} | {call: fn} | {wait: promise} | {hang} | {fail: Error}; it ends with end_turn */
function playback(steps, clock) {
  let aborted = null;
  let wake;
  const gate = new Promise((_, reject) => { wake = reject; });
  gate.catch(() => {});
  return {
    abort() { aborted ??= abortError(); wake(aborted); },
    async *[Symbol.asyncIterator]() {
      for (const step of steps) {
        if (aborted) throw aborted;
        if (step.start) yield { type: "message_start", message: { usage: { input_tokens: 100 } } };
        else if (step.text !== undefined) yield { type: "content_block_delta", delta: { type: "text_delta", text: step.text } };
        else if (step.tick) clock.tick(step.tick);
        else if (step.call) step.call();
        else if (step.wait) await step.wait;
        else if (step.hang) await gate;
        else if (step.fail) throw step.fail;
      }
      if (aborted) throw aborted;
    },
    async finalMessage() {
      if (aborted) throw aborted;
      return { stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 50 } };
    },
  };
}

/** One database and one scripted model for as many requests as a test makes. */
function setup(t, conversations = [], { usedToday = 0 } = {}) {
  t.mock.timers.reset(); // one clock per test
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: T0 });
  const tables = {
    profiles: [{ id: USER.id, plan: "ultimate" }],
    ai_conversations: conversations,
    ai_usage: [],
    daily_usage: usedToday ? [{ user_id: USER.id, usage_date: TODAY, message_count: usedToday }] : [],
    account_balances: [{ account_id: MAIN, owner_id: USER.id, kind: "main", currency: "GBP", balance_minor: "114100" }],
    accounts: [{ id: MAIN, owner_id: USER.id, kind: "main" }],
    transfers: [],
    savings_goals: [],
  };
  const db = fakeDb(tables, {
    rpc: {
      increment_daily_usage: ({ p_user_id, p_date }) => {
        let counter = tables.daily_usage.find((r) => r.user_id === p_user_id && r.usage_date === p_date);
        if (!counter) tables.daily_usage.push((counter = { user_id: p_user_id, usage_date: p_date, message_count: 0 }));
        return ++counter.message_count;
      },
    },
  });
  const w = { tables, db, sent: [], scripts: [], waiting: [], clock: t.mock.timers };
  w.script = (steps) => w.scripts.push(steps);
  w.opened = () => new Promise((resolve) => w.waiting.push(resolve)); // resolves when the next stream is opened
  globalThis.__routeTest = {
    db,
    user: USER,
    openStream: (params) => {
      w.sent.push(params);
      const steps = w.scripts.shift() ?? [];
      w.waiting.shift()?.();
      return playback(typeof steps === "function" ? steps(w) : steps, w.clock);
    },
  };
  return w;
}

function parseSse(text) {
  return text.split("\n\n").filter(Boolean).map((block) => ({
    event: /^event: (.*)$/m.exec(block)[1],
    data: JSON.parse(/^data: (.*)$/m.exec(block)[1]),
  }));
}

/** One request against the world, read to the end. */
async function post(w, route, body) {
  const res = await route.POST(new Request("http://localhost/api", {
    method: "POST",
    headers: { authorization: "Bearer test" },
    body: JSON.stringify(body),
  }));
  const raw = await res.text();
  const json = res.headers.get("content-type")?.includes("json") ? JSON.parse(raw) : null;
  const events = json ? [] : parseSse(raw);
  const conversationId = body.conversationId ?? events.find((e) => e.event === "meta")?.data.conversationId;
  const saved = w.tables.ai_conversations.find((c) => c.id === conversationId);
  return {
    status: res.status, json, events, saved,
    messages: saved?.messages ?? [],
    last: saved?.messages.at(-1),
    meta: events.find((e) => e.event === "meta")?.data,
    done: events.find((e) => e.event === "done")?.data,
    error: events.find((e) => e.event === "error")?.data,
  };
}

/** The common case: one request, one scripted reply. */
async function run(t, route, body, { steps = [], conversations = [], usedToday = 0 } = {}) {
  const w = setup(t, conversations, { usedToday });
  w.script(steps);
  const r = await post(w, route, body);
  return { ...r, w, sent: w.sent, tables: w.tables, db: w.db, used: w.tables.daily_usage[0]?.message_count ?? 0 };
}

const ask = { agentId: "marketer", input: "Plan for a bakery", conversationId: null };
const askChat = { message: "How am I doing?", conversationId: null };
const longRun = [{ start: 1 }, { text: "First half. " }, { tick: CHECKPOINT_EVERY_MS }, { text: "Second half. " }, { tick: RUNS_OUT }, { hang: 1 }];

// ── a reply that ends the ordinary way ────────────────────────────────────────

test("a complete reply is saved after the question, unmarked, counted, and reported as not truncated", async (t) => {
  const r = await run(t, agentRoute, ask, { steps: [{ start: 1 }, { text: "Hello " }, { text: "world" }] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.messages.map((m) => [m.role, m.content]), [["user", "Plan for a bakery"], ["assistant", "Hello world"]]);
  assert.ok(!("truncated" in r.last), "a whole reply carries no truncated key");
  assert.deepEqual([r.done.stopReason, r.done.truncated, r.done.continuationsLeft, r.done.used], ["end_turn", false, 0, 1]);
  assert.equal(r.tables.ai_usage.length, 1);
});

test("the routes' time limit is 150 s and the reply budget is taken from it", () => {
  for (const file of ["app/api/mobile/ai/neurooffice/route.ts", "app/api/mobile/ai/chat/route.ts"]) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /export const maxDuration = 150;/, file);
    assert.match(source, /budgetMsFor\(maxDuration\)/, `${file} takes its budget from maxDuration`);
  }
  assert.equal(budgetMsFor(150), 142_000);
  assert.equal(budgetMsFor(60), 52_000);
});

// ── the reply that used to vanish ─────────────────────────────────────────────

test("a reply still going when the time budget runs out is stopped by us and saved, marked, counted, reported as cut", async (t) => {
  const r = await run(t, agentRoute, ask, { steps: longRun });
  assert.equal(r.status, 200);
  assert.equal(r.last.content, "First half. Second half. ");
  assert.equal(r.last.truncated, true);
  assert.deepEqual([r.done.stopReason, r.done.truncated, r.done.continuationsLeft, r.done.used], ["time_limit", true, MAX_CONTINUATIONS, 1]);
  assert.equal(r.tables.ai_usage.length, 1, "the reply is billed even though the model never reported its tokens");
  assert.ok(r.tables.ai_usage[0].output_tokens > 0);
  assert.equal(r.error, undefined);
});

test("what the person has been shown is already in the database while the reply is still streaming", async (t) => {
  let whileStreaming;
  await run(t, agentRoute, ask, {
    steps: (w) => [
      { start: 1 }, { text: "Part A. " }, { tick: CHECKPOINT_EVERY_MS }, { text: "Part B. " },
      // a function stopped by the platform would end exactly here, and this is what it would leave
      { call: () => { whileStreaming = structuredClone(w.tables.ai_conversations[0].messages); } },
      { tick: RUNS_OUT }, { hang: 1 },
    ],
  });
  assert.deepEqual(whileStreaming.map((m) => m.role), ["user", "assistant"]);
  assert.equal(whileStreaming[1].content, "Part A. Part B. ");
  assert.equal(whileStreaming[1].truncated, true);
});

test("a reply is not rewritten to the database on every piece of text", async (t) => {
  const r = await run(t, agentRoute, ask, { steps: [{ start: 1 }, ...Array.from({ length: 50 }, () => ({ text: "word " })), { tick: 1000 }, { text: "more " }] });
  const replyWrites = r.db.writes.filter((x) => x.table === "ai_conversations" && x.kind === "update");
  assert.equal(replyWrites.length, 1, "only the final write, no checkpoint inside five seconds");
});

test("stopped before a single word: the person is told, nothing is saved as a reply, nothing is counted", async (t) => {
  const r = await run(t, agentRoute, ask, { steps: [{ start: 1 }, { tick: RUNS_OUT }, { hang: 1 }] });
  assert.equal(r.error.error, "time_limit");
  assert.equal(r.done, undefined);
  assert.deepEqual(r.messages.map((m) => m.role), ["user"]);
  assert.equal(r.used, 0);
});

// ── failures ──────────────────────────────────────────────────────────────────

test("the model failing mid-reply keeps what had arrived, marked cut, and does not count it", async (t) => {
  const r = await run(t, agentRoute, ask, { steps: [{ start: 1 }, { text: "Partial" }, { fail: new Error("Overloaded") }] });
  assert.equal(r.last.content, "Partial");
  assert.equal(r.last.truncated, true);
  assert.equal(r.error.error, "upstream_error");
  assert.equal(r.used, 0);
});

test("the model failing before any text leaves the question and no reply", async (t) => {
  const r = await run(t, agentRoute, ask, { steps: [{ start: 1 }, { fail: new Error("Overloaded") }] });
  assert.deepEqual(r.messages.map((m) => m.role), ["user"]);
  assert.equal(r.error.error, "upstream_error");
});

// ── continuing a cut reply ────────────────────────────────────────────────────

const cutConversation = (continuations = 0) => [row([user("Plan for a bakery"), cutAsst("Intro. Step one: do the", 9, continuations)])];
const cont = { agentId: "marketer", conversationId: CONV, continueFrom: 1 };

test("Continue extends the cut reply in place: no new question, one message that grew, no longer marked", async (t) => {
  const r = await run(t, agentRoute, cont, { conversations: cutConversation(), steps: [{ start: 1 }, { text: " first thing." }] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.messages.map((m) => m.role), ["user", "assistant"]);
  assert.equal(r.last.content, "Intro. Step one: do the first thing.");
  assert.ok(!("truncated" in r.last));
  assert.ok(!("continuingUntil" in r.last), "the 'being continued' mark is taken off when it ends");
  assert.equal(r.last.timestamp, stamp(9), "it is still the message it was");
  assert.equal(r.meta.continuedFrom, 1);
  assert.equal(r.done.truncated, false);
});

test("a continuation is not counted against the daily limit, and not held to it", async (t) => {
  const r = await run(t, agentRoute, cont, { conversations: cutConversation(), usedToday: DAILY_LIMIT, steps: [{ start: 1 }, { text: " ok." }] });
  assert.equal(r.status, 200, "the person is at the limit and can still finish the reply we cut");
  assert.equal(r.used, DAILY_LIMIT, "and it did not cost them a message");
  assert.equal(r.done.used, DAILY_LIMIT);
  const fresh = await run(t, agentRoute, ask, { usedToday: DAILY_LIMIT });
  assert.equal(fresh.status, 429, "a new message at the limit is still refused");
});

test("a reply can be continued twice and not a third time; the person is told how many are left", async (t) => {
  const again = [{ start: 1 }, { text: " more" }, { tick: RUNS_OUT }, { hang: 1 }]; // cut again each time
  const first = await run(t, agentRoute, cont, { conversations: cutConversation(0), steps: again });
  assert.deepEqual([first.last.continuations, first.done.truncated, first.done.continuationsLeft], [1, true, 1]);
  const second = await run(t, agentRoute, cont, { conversations: [first.saved], steps: again });
  assert.deepEqual([second.last.continuations, second.done.truncated, second.done.continuationsLeft], [2, true, 0]);
  assert.equal(second.last.content, "Intro. Step one: do the more more");
  const third = await run(t, agentRoute, cont, { conversations: [second.saved] });
  assert.equal(third.status, 409);
  assert.equal(third.json.error, "continuation_limit");
  assert.equal(third.sent.length, 0);
});

test("the cut reply is part of the history the model is sent, and the last turn is the server's note, not saved", async (t) => {
  const r = await run(t, agentRoute, cont, { conversations: cutConversation(), steps: [{ start: 1 }, { text: " x" }] });
  const sent = r.sent[0].messages;
  assert.deepEqual(sent.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(sent[0].content, "Plan for a bakery");
  assert.equal(sent[1].content, "Intro. Step one: do the");
  assert.match(sent[2].content, /Server note, not written by the user/);
  assert.match(sent[2].content, /Write the continuation only/);
  assert.ok(sent[2].content.includes("⟪Intro. Step one: do the⟫"), "the note marks the exact point where it stopped");
  assert.ok(!JSON.stringify(r.messages).includes("Server note"), "the note is never stored");
});

test("a continuation that gets nothing is given back: the person keeps the continuation it would have used", async (t) => {
  const failed = await run(t, agentRoute, cont, { conversations: cutConversation(), steps: [{ start: 1 }, { fail: new Error("Overloaded") }] });
  assert.equal(failed.error.error, "upstream_error");
  assert.ok(!("continuations" in failed.last), "back to none used");
  assert.ok(!("continuingUntil" in failed.last));
  assert.equal(failed.last.truncated, true, "and still cut, so the button stays");
  const slow = await run(t, agentRoute, cont, { conversations: cutConversation(1), steps: [{ start: 1 }, { tick: RUNS_OUT }, { hang: 1 }] });
  assert.equal(slow.error.error, "time_limit");
  assert.equal(slow.last.continuations, 1, "back to the one it had");
});

test("two taps on Continue give one continuation: the second is refused while the first is being written", async (t) => {
  const w = setup(t, cutConversation());
  const hold = deferred();
  w.script([{ start: 1 }, { text: " first" }, { wait: hold.promise }, { text: " tap." }]);
  const opened = w.opened();
  const firstTap = post(w, agentRoute, cont);
  await opened;
  const secondTap = await post(w, agentRoute, cont);
  assert.equal(secondTap.status, 409);
  assert.equal(secondTap.json.error, "not_continuable");
  assert.equal(w.sent.length, 1, "the model was called once");
  hold.resolve();
  const r = await firstTap;
  assert.equal(r.last.content, "Intro. Step one: do the first tap.");
  assert.equal(r.last.continuations, 1);
});

test("a 'being continued' mark left by a function that was stopped lapses, and the reply can be continued", async (t) => {
  const marked = (until) => [row([user("Plan"), { ...cutAsst("Cut", 9, 1), continuingUntil: until }])];
  const live = await run(t, agentRoute, cont, { conversations: marked(new Date(T0 + 60_000).toISOString()) });
  assert.equal(live.status, 409, "still within its time");
  const lapsed = await run(t, agentRoute, cont, { conversations: marked(new Date(T0 - 1000).toISOString()), steps: [{ start: 1 }, { text: " ok" }] });
  assert.equal(lapsed.status, 200);
  assert.equal(lapsed.last.content, "Cut ok");
});

test("Continue is refused, without calling the model, unless it is the cut reply at the end of this person's conversation with this agent", async (t) => {
  const whole = [row([user("Plan"), asst("All of it.")])];
  const notLast = [row([user("Plan"), cutAsst("Cut"), user("Never mind", 8), asst("Fine", 7)])];
  const cases = [
    ["a complete reply", cont, whole, 409, "not_continuable"],
    ["a cut reply that is not the latest message", cont, notLast, 409, "not_continuable"],
    ["a message that does not exist", { ...cont, continueFrom: 7 }, cutConversation(), 409, "not_continuable"],
    ["a question, not a reply", { ...cont, continueFrom: 0 }, [row([user("Plan")])], 409, "not_continuable"],
    ["a reply already continued twice", cont, cutConversation(MAX_CONTINUATIONS), 409, "continuation_limit"],
    ["a conversation that does not exist", { ...cont, conversationId: "44444444-4444-4444-8444-444444444444" }, cutConversation(), 404, "not_found"],
    ["another agent's conversation", cont, [row([user("Plan"), cutAsst("Cut")], "designer")], 404, "not_found"],
    ["another person's conversation", cont, [row([user("Plan"), cutAsst("Cut")], "marketer", OTHER)], 404, "not_found"],
  ];
  for (const [name, body, conversations, status, error] of cases) {
    const r = await run(t, agentRoute, body, { conversations });
    assert.equal(r.status, status, name);
    assert.equal(r.json.error, error, name);
    assert.equal(r.sent.length, 0, `${name}: the model was not called`);
    assert.equal(r.used, 0, name);
  }
});

test("a request is a new message or a continuation, never both and never neither", async (t) => {
  for (const [name, body] of [
    ["both", { ...cont, input: "and more" }],
    ["neither", { agentId: "marketer", conversationId: CONV }],
    ["continuation without a conversation", { agentId: "marketer", conversationId: null, continueFrom: 1 }],
    ["a negative position", { ...cont, continueFrom: -1 }],
  ]) {
    const r = await run(t, agentRoute, body, { conversations: cutConversation() });
    assert.equal(r.status, 400, name);
    assert.equal(r.sent.length, 0, name);
  }
});

test("the conversation endpoint says how many continuations a cut reply has left", async (t) => {
  setup(t, [row([user("q"), asst("whole"), user("q2"), cutAsst("cut", 5, 1)])]);
  const res = await conversationRoute.GET(new Request("http://localhost/api?limit=30", { headers: { authorization: "Bearer t" } }), { params: { id: CONV } });
  const { messages } = await res.json();
  assert.deepEqual(messages.map((m) => [m.truncated ?? null, m.continuationsLeft ?? null]), [[null, null], [null, null], [null, null], [true, 1]]);
  assert.ok(messages.every((m) => !("rid" in m) && !("continuations" in m) && !("continuingUntil" in m)), "bookkeeping is not sent to the app");
});

// ── two requests on one conversation ──────────────────────────────────────────

test("a second message sent while the first reply is still streaming loses nothing: both pairs end up in order", async (t) => {
  const w = setup(t, [row([user("Q0", 30), asst("A0", 29)])]);
  const hold = deferred();
  w.script([{ start: 1 }, { text: "A1 begins. " }, { wait: hold.promise }, { text: "A1 ends." }]);
  w.script([{ start: 1 }, { text: "A2." }]);
  const opened = w.opened();
  const first = post(w, agentRoute, { agentId: "marketer", input: "Q1", conversationId: CONV });
  await opened;
  const second = await post(w, agentRoute, { agentId: "marketer", input: "Q2", conversationId: CONV }); // runs to its end meanwhile
  hold.resolve();
  await first;
  const messages = w.tables.ai_conversations[0].messages;
  assert.deepEqual(messages.map((m) => m.content), ["Q0", "A0", "Q1", "A1 begins. A1 ends.", "Q2", "A2."]);
  assert.deepEqual(messages.map((m) => m.role), ["user", "assistant", "user", "assistant", "user", "assistant"]);
  assert.ok(messages.every((m) => !m.truncated));
  assert.equal(second.done.used, 1);
  assert.equal(w.tables.daily_usage[0].message_count, 2, "both replies counted");
});

test("the same on the main assistant, with a checkpoint of the long reply landing after the other's writes", async (t) => {
  const w = setup(t, []);
  const hold = deferred();
  w.script([{ start: 1 }, { text: "A1 " }, { wait: hold.promise }, { text: "more " }, { tick: CHECKPOINT_EVERY_MS }, { text: "end." }]);
  w.script([{ start: 1 }, { text: "A2." }]);
  const opened = w.opened();
  const first = post(w, chatRoute, { conversationId: null, message: "Q1" });
  await opened;
  const id = w.tables.ai_conversations[0].id;
  await post(w, chatRoute, { conversationId: id, message: "Q2" });
  hold.resolve();
  await first;
  assert.deepEqual(w.tables.ai_conversations[0].messages.map((m) => m.content), ["Q1", "A1 more end.", "Q2", "A2."]);
});

test("a write is made again on top of what somebody wrote in between, not over it", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 });
  const tables = { ai_conversations: [row([{ ...user("Q0"), rid: "old" }])] };
  const real = fakeDb(tables);
  let intruded = 0;
  // somebody else writes (a second device, another request) between our read and our write
  const db = {
    from(name) {
      const b = real.from(name);
      const update = b.update;
      b.update = (values) => {
        if (!intruded++) {
          tables.ai_conversations[0].messages.push({ ...user("Q-from-elsewhere", 5), rid: "other" });
          tables.ai_conversations[0].updated_at = stamp(0);
        }
        return update.call(b, values);
      };
      return b;
    },
  };
  const result = await commit(db, { id: CONV, userId: USER.id }, { rid: "mine", user: user("Q-mine", 4), reply: { text: "A-mine", cut: false, at: stamp(3) } });
  assert.equal(result, "ok");
  assert.deepEqual(tables.ai_conversations[0].messages.map((m) => m.content), ["Q0", "Q-from-elsewhere", "Q-mine", "A-mine"]);
  assert.equal(real.writes.filter((x) => x.kind === "update").length, 2, "the first write found the row changed and was made again");
});

test("a conversation too busy to write to says so instead of looping", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 });
  const tables = { ai_conversations: [row([user("Q0")])] };
  const real = fakeDb(tables);
  const db = {
    from(name) {
      const b = real.from(name);
      const update = b.update;
      b.update = (values) => { tables.ai_conversations[0].updated_at = new Date(Date.parse(tables.ai_conversations[0].updated_at) + 5).toISOString(); return update.call(b, values); };
      return b;
    },
  };
  await assert.rejects(commit(db, { id: CONV, userId: USER.id }, { rid: "mine", user: user("Q1") }), /too often/);
});

test("a failed first write: the person is told, and the model is not called", async (t) => {
  const w = setup(t, []);
  const from = w.db.from;
  w.db.from = (name) => {
    const b = from(name);
    if (name === "ai_conversations") b.insert = () => { throw new Error("database down"); };
    return b;
  };
  w.script([{ start: 1 }, { text: "never" }]);
  const r = await post(w, agentRoute, ask);
  assert.equal(r.status, 503);
  assert.equal(r.json.error, "conversation_busy");
  assert.equal(w.sent.length, 0);
});

// ── the main assistant is the same ────────────────────────────────────────────

test("the main assistant: a long reply is stopped, saved, marked and reported the same way, and can be continued", async (t) => {
  const first = await run(t, chatRoute, askChat, { steps: longRun });
  assert.equal(first.last.content, "First half. Second half. ");
  assert.equal(first.last.truncated, true);
  assert.deepEqual([first.done.stopReason, first.done.truncated, first.done.used], ["time_limit", true, 1]);
  assert.equal(first.saved.agent_id, undefined, "the assistant's conversation has no agent");

  const second = await run(t, chatRoute, { conversationId: CONV, continueFrom: 1 }, {
    conversations: [{ ...first.saved, id: CONV }],
    steps: [{ start: 1 }, { text: "The end." }],
  });
  assert.equal(second.last.content, "First half. Second half. The end.");
  assert.ok(!("truncated" in second.last));
  assert.deepEqual(second.messages.map((m) => m.role), ["user", "assistant"]);
  assert.equal(second.used, 0, "and the continuation was not counted (the first reply's count was in the other world)");
});

test("the main assistant will not continue an agent's conversation", async (t) => {
  const r = await run(t, chatRoute, { conversationId: CONV, continueFrom: 1 }, { conversations: cutConversation() });
  assert.equal(r.status, 404);
  assert.equal(r.sent.length, 0);
});

// ── the pieces ────────────────────────────────────────────────────────────────

test("applyOurs puts a question at the end and its answer right after it, and replaces an answer in place", () => {
  const base = [{ ...user("old q"), rid: "a" }, { ...asst("old a"), rid: "a" }, { ...user("later q"), rid: "b" }];
  const withAnswer = applyOurs(base, { rid: "c", user: user("q"), reply: { text: "x", cut: true, at: "T" } });
  assert.deepEqual(withAnswer.map((m) => m.content), ["old q", "old a", "later q", "q", "x"]);
  const longer = applyOurs(withAnswer, { rid: "c", user: user("q"), reply: { text: "xy", cut: false, at: "T2" } });
  assert.deepEqual(longer.map((m) => m.content), ["old q", "old a", "later q", "q", "xy"]);
  assert.ok(!("truncated" in longer.at(-1)));
  // an earlier request's answer lands beside its own question, not at the end
  const late = applyOurs(base, { rid: "b", reply: { text: "b's answer", cut: false, at: "T3" } });
  assert.deepEqual(late.map((m) => m.content), ["old q", "old a", "later q", "b's answer"]);
  const middle = applyOurs([{ ...user("one"), rid: "a" }, { ...user("two"), rid: "b" }], { rid: "a", reply: { text: "ans a", cut: false, at: "T" } });
  assert.deepEqual(middle.map((m) => m.content), ["one", "ans a", "two"]);
  assert.equal(base.length, 3, "the input is not modified");
});

test("applyOurs: a continuation extends the message it names, only while the count is what it expected", () => {
  const list = [user("q"), cutAsst("ab", 9, 1)];
  const go = (c, reply) => applyOurs(list, { rid: "r", continuing: { timestamp: stamp(9), baseContent: "ab", ...c }, reply });
  assert.equal(go({ expect: 0, set: 1 }, { text: "", cut: true, at: "T" }), null, "the count has moved: it was taken");
  assert.equal(applyOurs([user("q")], { rid: "r", continuing: { timestamp: stamp(9), baseContent: "ab", expect: 1, set: 1 } }), null, "the message is gone");
  const held = go({ expect: 1, set: 1 }, { text: "cd", cut: true, at: "T" });
  assert.deepEqual([held[1].content, held[1].truncated, held[1].continuations], ["abcd", true, 1]);
  const done = go({ expect: 1, set: 1, release: true }, { text: "cd", cut: false, at: "T" });
  assert.deepEqual([done[1].content, "truncated" in done[1], done[1].continuations], ["abcd", false, 1]);
  const given = go({ expect: 1, set: 0, release: true }, { text: "", cut: true, at: "T" });
  assert.ok(!("continuations" in given[1]), "given back: none used");
  assert.equal(list[1].content, "ab", "the input is not modified");
});

test("continuationProblem, continuationsLeft, isCut and nextStamp", () => {
  const c = [user("q"), cutAsst("ab")];
  assert.equal(continuationProblem(c, 1), null);
  assert.equal(continuationProblem(c, 0).code, "not_continuable");
  assert.equal(continuationProblem(c, 5).code, "not_continuable");
  assert.equal(continuationProblem([user("q"), asst("ab")], 1).code, "not_continuable");
  assert.equal(continuationProblem([user("q"), cutAsst("ab", 9, 2)], 1).code, "continuation_limit");
  assert.deepEqual([{}, { continuations: 1 }, { continuations: 2 }, { continuations: 5 }].map(continuationsLeft), [2, 1, 0, 0]);
  assert.deepEqual(["max_tokens", "time_limit", "end_turn", "stop_sequence"].map(isCut), [true, true, false, false]);
  const now = new Date("2026-11-03T05:00:00.000Z");
  assert.equal(nextStamp("2026-11-03T04:00:00+00:00", now), "2026-11-03T05:00:00.000Z");
  assert.equal(nextStamp("2026-11-03T05:00:00.000+00:00", now), "2026-11-03T05:00:00.001Z", "never the same version twice");
});

test("the note shows only the last characters of a long reply", () => {
  const note = continuationNote("x".repeat(5000) + "THE END");
  assert.ok(note.includes("⟪" + "x".repeat(193) + "THE END⟫"));
  assert.ok(!note.includes("x".repeat(194) + "THE END"), "no more than the last 200 characters");
});
