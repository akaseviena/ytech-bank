import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

// The web assistant's POST handler (app/api/ai/route.ts), run on a stand-in database and model.
// The conversation it saves is the same row the app reads and writes, so what matters here is
// that saving adds this request's two messages to the conversation as it is now and changes
// nothing else: not the fields the app put on its messages, not messages the app added after
// the page was opened.

register("./test-support/alias-hooks.mjs", import.meta.url);
register("./test-support/route-hooks.mjs", import.meta.url);

const route = await import("../app/api/ai/route.ts");
const agentRoute = await import("../app/api/neurooffice/route.ts");

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const MAIN = "22222222-2222-4222-8222-222222222222";
const CONV = "33333333-3333-4333-8333-333333333333";
const T0 = 1_700_000_000_000;
const stamp = (n) => new Date(T0 - 1000 * n).toISOString();

// messages as the app writes them: with the bookkeeping the web must leave alone
const appMessages = () => [
  { role: "user", content: "Plan my month", timestamp: stamp(30), rid: "r1" },
  { role: "assistant", content: "First part of the plan", timestamp: stamp(29), rid: "r1", truncated: true, continuations: 1 },
];

function setup(t, messages, { reply = "Fine.", stop = "end_turn", fail = false, blocks = null } = {}) {
  t.mock.timers.reset(); // a test may set up more than once
  t.mock.timers.enable({ apis: ["Date"], now: T0 });
  const tables = {
    ai_conversations: messages ? [{ id: CONV, user_id: USER.id, agent_id: null, messages, updated_at: stamp(20) }] : [],
    daily_usage: [],
    account_balances: [{ account_id: MAIN, owner_id: USER.id, kind: "main", currency: "GBP", balance_minor: "114100" }],
    accounts: [{ id: MAIN, owner_id: USER.id, kind: "main" }],
    transfers: [],
    savings_goals: [],
    profiles: [{ id: USER.id, plan: "ultimate" }],
  };
  const db = fakeDb(tables, {
    rpc: { increment_daily_usage: () => { tables.daily_usage.push({}); return tables.daily_usage.length; } },
  });
  const sent = [];
  globalThis.__routeTest = {
    db,
    user: USER,
    create: async (params) => {
      sent.push(params);
      if (fail) throw new Error("Overloaded");
      return { content: blocks ?? [{ type: "text", text: reply }], stop_reason: stop, usage: { input_tokens: 10, output_tokens: 5 } };
    },
  };
  return { tables, db, sent };
}

const post = async (body) => {
  const res = await route.POST(new Request("http://localhost/api/ai", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

test("a message adds its question and answer to the conversation and leaves the app's messages exactly as they were", async (t) => {
  const w = setup(t, appMessages(), { reply: "Here is the next step." });
  const r = await post({ message: "And then?", conversationId: CONV, conversationHistory: [] });
  assert.equal(r.status, 200);
  assert.equal(r.json.reply, "Here is the next step.");
  const saved = w.tables.ai_conversations[0].messages;
  assert.deepEqual(saved.slice(0, 2), appMessages(), "timestamp, truncated, continuations and rid are untouched");
  assert.deepEqual(saved.slice(2).map((m) => [m.role, m.content]), [["user", "And then?"], ["assistant", "Here is the next step."]]);
  assert.ok(saved.slice(2).every((m) => m.timestamp && m.rid), "the new messages carry a timestamp");
});

test("what the app added after the page was opened is not lost, and the model is sent the saved conversation, not the browser's copy", async (t) => {
  const onPhone = [...appMessages(), { role: "user", content: "Typed on the phone", timestamp: stamp(10), rid: "r2" }, { role: "assistant", content: "Answered on the phone", timestamp: stamp(9), rid: "r2" }];
  const w = setup(t, onPhone);
  // the page was opened before the phone messages existed: its copy has only the first two
  const stale = [{ role: "user", content: "Plan my month" }, { role: "assistant", content: "First part of the plan" }];
  await post({ message: "From the web", conversationId: CONV, conversationHistory: stale });
  const saved = w.tables.ai_conversations[0].messages;
  assert.deepEqual(saved.map((m) => m.content), ["Plan my month", "First part of the plan", "Typed on the phone", "Answered on the phone", "From the web", "Fine."]);
  assert.deepEqual(w.sent[0].messages.map((m) => m.role), ["user", "assistant", "user", "assistant", "user"]);
  assert.equal(w.sent[0].messages[2].content, "Typed on the phone");
});

test("a conversation the web starts is created by the server under the id the page chose", async (t) => {
  const w = setup(t, null);
  await post({ message: "Hello", conversationId: CONV, conversationHistory: [] });
  assert.equal(w.tables.ai_conversations.length, 1);
  assert.equal(w.tables.ai_conversations[0].id, CONV);
  assert.ok(!("agent_id" in w.tables.ai_conversations[0]) || w.tables.ai_conversations[0].agent_id == null, "it is the main assistant's");
  assert.deepEqual(w.tables.ai_conversations[0].messages.map((m) => m.role), ["user", "assistant"]);
});

test("a reply that stopped at the length limit is marked, so the app can offer to continue it", async (t) => {
  const w = setup(t, null, { reply: "Cut off mid", stop: "max_tokens" });
  const r = await post({ message: "Write a lot", conversationId: CONV, conversationHistory: [] });
  assert.equal(r.json.truncated, true);
  assert.equal(w.tables.ai_conversations[0].messages.at(-1).truncated, true);
});

test("without a conversation id nothing is saved and the browser's history is used, as before", async (t) => {
  const w = setup(t, null);
  const r = await post({ message: "Hi", conversationHistory: [{ role: "user", content: "Earlier" }, { role: "assistant", content: "Reply" }] });
  assert.equal(r.status, 200);
  assert.equal(w.tables.ai_conversations.length, 0);
  assert.equal(w.sent[0].messages.length, 3);
});

test("if the model fails, the question is kept and the page gets an error, not a half-saved answer", async (t) => {
  const w = setup(t, appMessages(), { fail: true });
  await assert.rejects(post({ message: "Will fail", conversationId: CONV, conversationHistory: [] }));
  const saved = w.tables.ai_conversations[0].messages;
  assert.deepEqual(saved.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(saved.at(-1).content, "Will fail");
});

// ── the model the web runs on ─────────────────────────────────────────────────

test("the web assistant and the web agents run on Sonnet 5 with thinking off, so no thinking is paid for or eats the reply's token limit", async (t) => {
  const w = setup(t, null);
  await post({ message: "Hi", conversationId: CONV, conversationHistory: [] });
  assert.equal(w.sent[0].model, "claude-sonnet-5");
  assert.deepEqual(w.sent[0].thinking, { type: "disabled" });
  assert.ok(!("temperature" in w.sent[0]) && !("top_p" in w.sent[0]), "no sampling parameters, which this model refuses");

  const a = setup(t, null);
  const res = await agentRoute.POST(new Request("http://localhost/api/neurooffice", { method: "POST", body: JSON.stringify({ agentType: "marketer", input: "Plan for a bakery" }) }));
  assert.equal(res.status, 200);
  assert.equal(a.sent[0].model, "claude-sonnet-5");
  assert.deepEqual(a.sent[0].thinking, { type: "disabled" });
});

test("the reply is the text of the response, wherever a non-text block sits", async (t) => {
  setup(t, null, { blocks: [{ type: "thinking", thinking: "" }, { type: "text", text: "Part one. " }, { type: "text", text: "Part two." }] });
  const r = await post({ message: "Hi", conversationId: CONV, conversationHistory: [] });
  assert.equal(r.json.reply, "Part one. Part two.");
  const a = setup(t, null, { blocks: [{ type: "thinking", thinking: "" }, { type: "text", text: "Agent text" }] });
  const res = await agentRoute.POST(new Request("http://localhost/api/neurooffice", { method: "POST", body: JSON.stringify({ agentType: "lawyer", input: "Q" }) }));
  assert.equal((await res.json()).result, "Agent text");
  void a;
});
