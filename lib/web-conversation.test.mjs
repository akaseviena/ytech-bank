import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

register("./test-support/alias-hooks.mjs", import.meta.url);
const { openLatestConversation, startConversation, deleteConversation } = await import("./web-conversation.ts");

// Which conversation the web assistant opens, and what "New" does. The data is the shape of the
// real defect: one person, two main conversations (one per device, as the page used to keep them),
// a specialist's thread newer than both, and another person's thread newer still.

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const row = (id, user, agent, updated, n = 2) => ({
  id, user_id: user, agent_id: agent, updated_at: updated,
  messages: Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `${id}-${i}`, timestamp: updated })),
});
const seed = () => [
  row("desktop-17-nov", ME, null, "2026-11-17T07:18:25.293Z", 58),
  row("phone-22-nov", ME, null, "2026-11-22T10:02:46.522Z", 34),
  row("consultant-thread", ME, "consultant", "2026-11-22T11:00:00.000Z"),
  row("someone-elses", OTHER, null, "2026-11-22T12:00:00.000Z"),
];

test("the conversation opened is the person's newest main one, not another agent's and not anyone else's", async () => {
  const db = fakeDb({ ai_conversations: seed() });
  const opened = await openLatestConversation(db, ME);
  assert.equal(opened.id, "phone-22-nov");
  assert.equal(opened.messages.length, 34);
});

test("it does not matter which of the two threads a browser would have remembered: the newer one is opened", async () => {
  // what the old page did: open the conversation whose id this browser kept, here the desktop's
  const tables = { ai_conversations: seed() };
  const remembered = fakeDb(tables).from("ai_conversations").select("id, messages").eq("id", "desktop-17-nov").maybeSingle();
  assert.equal((await remembered).data.id, "desktop-17-nov", "(the old rule showed this one)");
  assert.equal((await openLatestConversation(fakeDb(tables), ME)).id, "phone-22-nov");
});

test("a person with nothing saved gets an empty conversation under a fresh id, not an error", async () => {
  const opened = await openLatestConversation(fakeDb({ ai_conversations: [row("someone-elses", OTHER, null, "2026-11-22T12:00:00.000Z")] }), ME);
  assert.deepEqual(opened.messages, []);
  assert.match(opened.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("'New' makes an empty conversation, deletes nothing, and the next opening is that empty one", async () => {
  const tables = { ai_conversations: seed() };
  const before = structuredClone(tables.ai_conversations);
  const db = fakeDb(tables);
  const id = await startConversation(db, ME);
  assert.equal(tables.ai_conversations.length, before.length + 1, "one more row");
  assert.deepEqual(tables.ai_conversations.slice(0, before.length), before, "every existing conversation is exactly as it was");
  const made = tables.ai_conversations.find((r) => r.id === id);
  assert.deepEqual([made.user_id, made.agent_id, made.messages], [ME, null, []]);
  const opened = await openLatestConversation(fakeDb(tables), ME);
  assert.equal(opened.id, id, "a reload opens the new conversation, not the one just left");
  assert.deepEqual(opened.messages, []);
  assert.ok(!db.writes.some((w) => w.kind !== "insert"), "nothing but an insert was written");
});

test("if the empty row cannot be made, 'New' still gives a usable id and does not throw", async () => {
  const failing = { from: () => ({ insert: async () => ({ error: { message: "permission denied" } }) }) };
  const warn = console.warn; console.warn = () => {};
  try {
    const id = await startConversation(failing, ME);
    assert.match(id, /^[0-9a-f]{8}-/);
  } finally { console.warn = warn; }
});

test("'Delete this conversation' removes that one conversation and no other", async () => {
  const tables = { ai_conversations: seed() };
  const db = fakeDb(tables);
  assert.equal(await deleteConversation(db, ME, "phone-22-nov"), true);
  assert.deepEqual(tables.ai_conversations.map((r) => r.id).sort(), ["consultant-thread", "desktop-17-nov", "someone-elses"]);
  // and the person lands on the newest of what is left, as a reload would
  assert.equal((await openLatestConversation(fakeDb(tables), ME)).id, "desktop-17-nov");
});

test("it cannot reach a specialist's thread, someone else's conversation, or a conversation that is not there", async () => {
  const tables = { ai_conversations: seed() };
  const db = fakeDb(tables);
  await deleteConversation(db, ME, "consultant-thread");
  await deleteConversation(db, ME, "someone-elses");
  await deleteConversation(db, ME, "no-such-id");
  assert.equal(tables.ai_conversations.length, 4, "nothing was removed");
});

test("if the deletion fails it says so, and the conversation is still there", async () => {
  const failing = { from: () => ({ delete: () => ({ eq: () => ({ eq: () => ({ is: async () => ({ error: { message: "permission denied" } }) }) }) }) }) };
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal(await deleteConversation(failing, ME, "phone-22-nov"), false);
  } finally { console.warn = warn; }
});

test("the page: New and Delete are two buttons; New deletes nothing; Delete asks first and reports a failure instead of pretending", () => {
  const page = fs.readFileSync(new URL("../app/(dashboard)/ai-assistant/page.tsx", import.meta.url), "utf8");
  assert.match(page, /openLatestConversation\(/);
  assert.match(page, /startConversation\(/);
  assert.match(page, /deleteConversation\(/);
  assert.ok(!/\.delete\(\)/.test(page), "the page itself issues no delete: it goes through lib/web-conversation.ts");
  assert.ok(!/localStorage\.(getItem|setItem)/.test(page), "no conversation id is kept in the browser");
  // New: the function body has no deletion in it
  const neu = page.slice(page.indexOf("async function handleNew"), page.indexOf("function closeDelete"));
  assert.ok(neu.includes("startConversation(") && !/delete/i.test(neu), "New touches nothing");
  // Delete: behind a confirmation that says what will happen, with an honest failure message
  assert.match(page, /Delete this conversation\?/);
  assert.match(page, /permanently deleted/);
  assert.match(page, /Could not delete this conversation/);
  assert.match(page, /onClick=\{\(\) => setShowDeleteConfirm\(true\)\}/, "the button only opens the confirmation");
});
