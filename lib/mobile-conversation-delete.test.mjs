import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

// DELETE /api/mobile/ai/conversations/:id, and the facts the app's list depends on (what the preview
// is, whether an empty conversation is in the list, how many it takes). Real route handlers, a
// stand-in database and signed-in user (lib/test-support/route-hooks.mjs).

register("./test-support/alias-hooks.mjs", import.meta.url);
register("./test-support/route-hooks.mjs", import.meta.url);

const idRoute = await import("../app/api/mobile/ai/conversations/[id]/route.ts");
const listRoute = await import("../app/api/mobile/ai/conversations/route.ts");
const { commit } = await import("./mobile/conversation-store.ts");

const ME = { id: "11111111-1111-4111-8111-111111111111" };
const OTHER = "99999999-9999-4999-8999-999999999999";
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "aaaaaaaa-0000-4000-8000-000000000002"; // an agent's conversation of mine
const C = "aaaaaaaa-0000-4000-8000-000000000003"; // an empty one
const THEIRS = "aaaaaaaa-0000-4000-8000-000000000009";
const GONE = "aaaaaaaa-0000-4000-8000-0000000000ff";

const msg = (role, content, at = "2026-11-22T10:00:00Z") => ({ role, content, timestamp: at });
const rows = () => [
  { id: A, user_id: ME.id, agent_id: null, updated_at: "2026-11-22T10:02:00Z", messages: [msg("user", "First question\nwith a second line"), msg("assistant", "A reply"), msg("user", "The LAST thing said, " + "x".repeat(200))] },
  { id: B, user_id: ME.id, agent_id: "marketer", updated_at: "2026-11-21T10:00:00Z", messages: [msg("user", "plan"), msg("assistant", "here")] },
  { id: C, user_id: ME.id, agent_id: null, updated_at: "2026-11-22T12:00:00Z", messages: [] },
  { id: THEIRS, user_id: OTHER, agent_id: null, updated_at: "2026-11-22T11:00:00Z", messages: [msg("user", "someone else's secret")] },
];

function setup(user = ME, tables = { ai_conversations: rows() }) {
  const db = fakeDb(tables);
  globalThis.__routeTest = { db, user };
  return { db, tables };
}
const del = async (id) => {
  const res = await idRoute.DELETE(new Request(`http://localhost/api/mobile/ai/conversations/${id}`, { method: "DELETE", headers: { authorization: "Bearer t" } }), { params: { id } });
  return { status: res.status, body: await res.json() };
};
const get = async (id) => {
  const res = await idRoute.GET(new Request(`http://localhost/api?limit=30`, { headers: { authorization: "Bearer t" } }), { params: { id } });
  return { status: res.status, body: await res.json() };
};
const list = async (qs) => {
  const res = await listRoute.GET(new Request(`http://localhost/api/mobile/ai/conversations?${qs}`, { headers: { authorization: "Bearer t" } }));
  return { status: res.status, body: await res.json() };
};

test("DELETE: 200 {ok, conversationId}; the conversation and every message in it are gone; nobody else's row is touched", async () => {
  const { tables } = setup();
  const r = await del(A);
  assert.deepEqual(r, { status: 200, body: { ok: true, conversationId: A } });
  assert.deepEqual(tables.ai_conversations.map((x) => x.id).sort(), [B, C, THEIRS].sort());
  assert.equal(JSON.stringify(tables).includes("The LAST thing said"), false, "its messages were in the row, and the row is gone");
  assert.equal((await get(A)).status, 404, "and it can no longer be opened");
});

test("DELETE again is a 404: 'it is gone'", async () => {
  setup();
  await del(A);
  assert.equal((await del(A)).status, 404);
});

test("someone else's id, an id that never existed and an id already deleted answer the very same 404, and the other person's row stays", async () => {
  const { tables } = setup();
  await del(A);
  const theirs = await del(THEIRS);
  const never = await del(GONE);
  const deleted = await del(A);
  assert.deepEqual(theirs, { status: 404, body: { error: "not_found", message: "Conversation not found." } });
  assert.deepEqual(never, theirs);
  assert.deepEqual(deleted, theirs);
  assert.ok(tables.ai_conversations.some((x) => x.id === THEIRS), "the other person's conversation is still there");
});

test("it is by id: a NeuroOffice agent's conversation and an empty one go the same way", async () => {
  const { tables } = setup();
  assert.equal((await del(B)).status, 200);
  assert.equal((await del(C)).status, 200);
  assert.deepEqual(tables.ai_conversations.map((x) => x.id).sort(), [A, THEIRS].sort());
});

test("400 for an id that is not a UUID, 401 without a signed-in user, 500 when the database fails (and it does not say it worked)", async () => {
  const { tables } = setup();
  assert.equal((await del("not-a-uuid")).status, 400);
  assert.equal(tables.ai_conversations.length, 4, "nothing removed");
  setup(null);
  assert.equal((await del(A)).status, 401);
  setup();
  globalThis.__routeTest.db = { from: () => ({ delete: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: null, error: { message: "down" } }) }) }) }) }) };
  const err = console.error; console.error = () => {};
  try {
    const r = await del(A);
    assert.equal(r.status, 500);
    assert.equal(r.body.error, "upstream_error");
  } finally { console.error = err; }
});

// This test used to pin the OPPOSITE, as a documented hazard: a reply saved into a conversation that had
// just been deleted made it again, holding only that exchange ("deleted it, and it came back as a
// fragment"). That was behaviour, not an oversight: commit() inserted whenever the row was missing. It
// is closed now (lib/mobile/conversation-store.ts), and the old assertion is kept inverted so that the
// history stays readable.
test("a reply saved into a conversation that has just been deleted does NOT bring it back (it used to)", async () => {
  const { db, tables } = setup();
  await del(A);
  const result = await commit(db, { id: A, userId: ME.id }, { rid: "r1", user: msg("user", "asked before the delete"), reply: { text: "partial", cut: true, at: "2026-11-22T10:05:00Z" } });
  assert.equal(result, "gone");
  assert.equal(tables.ai_conversations.some((x) => x.id === A), false, "it stays deleted");
});

// ── what the app's LIST does (so the answer to the app is a fact, and a change shows up) ────────────

test("the list takes limit=30 (up to 50; 51 is a 400) and includes empty conversations, messageCount 0, preview empty", async () => {
  setup();
  const ok = await list("agentId=main&limit=30");
  assert.equal(ok.status, 200);
  const empty = ok.body.conversations.find((c) => c.id === C);
  assert.deepEqual([empty.messageCount, empty.preview], [0, ""]);
  assert.equal((await list("agentId=main&limit=50")).status, 200);
  assert.equal((await list("agentId=main&limit=51")).status, 400);
  assert.equal((await list("agentId=main")).body.conversations.length, 2, "the default is 10; here there are two main ones");
});

test("the list's preview is the LAST message's first 120 characters, not the first line of the first message", async () => {
  setup();
  const a = (await list("agentId=main&limit=30")).body.conversations.find((c) => c.id === A);
  assert.equal(a.preview, ("The LAST thing said, " + "x".repeat(200)).slice(0, 120));
  assert.ok(!a.preview.includes("First question"), "not the first message");
  assert.equal(a.messageCount, 3);
});

test("the list is newest first, only the signed-in person's, and a NeuroOffice agent's conversations are in its own list", async () => {
  setup();
  const main = (await list("agentId=main&limit=30")).body.conversations.map((c) => c.id);
  assert.deepEqual(main, [C, A], "newest first; no agent's, no one else's");
  assert.deepEqual((await list("agentId=marketer&limit=30")).body.conversations.map((c) => c.id), [B]);
});

// ── title: the same string on both surfaces, by construction ─────────────────────────────────────

const { listConversations, EMPTY_TITLE } = await import("./web-conversation.ts");

test("the app's list has a title: the first line of the first message; preview is unchanged", async () => {
  setup();
  const { body } = await list("agentId=main&limit=30");
  const a = body.conversations.find((c) => c.id === A);
  assert.equal(a.title, "First question");
  assert.equal(a.preview, ("The LAST thing said, " + "x".repeat(200)).slice(0, 120), "preview is what it was");
  assert.equal(body.conversations.find((c) => c.id === C).title, EMPTY_TITLE, "an empty conversation is 'New conversation'");
  assert.ok(Object.keys(a).sort().join() === "agentId,id,messageCount,preview,title,updatedAt", "one new key, none removed");
});

test("the web's list and the app's list give every conversation the very same title", async () => {
  const { db } = setup();
  const web = await listConversations(db, ME.id);
  const app = (await list("agentId=main&limit=30")).body.conversations;
  assert.deepEqual(app.map((c) => [c.id, c.title]), web.map((c) => [c.id, c.title]));
  assert.ok(web.length === 2 && web.every((c) => c.title));
});

test("a long first line, a first message that starts with blank lines, and an emoji at the cut: still the same on both", async () => {
  const tables = {
    ai_conversations: [
      { id: A, user_id: ME.id, agent_id: null, updated_at: "2026-11-22T10:00:00Z", messages: [msg("user", "\n\n  spaced   out   question  \nsecond")] },
      { id: B, user_id: ME.id, agent_id: null, updated_at: "2026-11-22T09:00:00Z", messages: [msg("user", "x".repeat(69) + "🎯 and the rest of a long line")] },
    ],
  };
  const { db } = setup(ME, tables);
  const web = await listConversations(db, ME.id);
  const app = (await list("agentId=main&limit=30")).body.conversations;
  assert.deepEqual(app.map((c) => c.title), web.map((c) => c.title));
  assert.deepEqual(app.map((c) => c.title), ["spaced out question", "x".repeat(69) + "🎯…"]);
});
