import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

register("./test-support/alias-hooks.mjs", import.meta.url);
const { LIST_LIMIT, EMPTY_TITLE, conversationTitle, listConversations, openConversation, startConversation, openLatestConversation } =
  await import("./web-conversation.ts");

// The list: the way back to a conversation you are not in. A person with two devices, the app's thread
// among them, a specialist's thread, someone else's, and the empty one "New" leaves behind.

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const msg = (role, content, at) => ({ role, content, timestamp: at });
const row = (id, user, agent, updated, messages) => ({ id, user_id: user, agent_id: agent, updated_at: updated, messages });
const seed = () => [
  row("desktop", ME, null, "2026-11-17T07:18:25.000Z", [msg("user", "Привет! Что с балансом и доходы/расходы?", "2026-11-17T07:18:19Z"), msg("assistant", "Баланс сейчас…", "2026-11-17T07:18:25Z")]),
  row("phone", ME, null, "2026-11-22T10:02:46.000Z", [msg("user", "Привет! Что там по моему бюджету на сегодня?", "2026-11-20T17:53:38Z")]),
  row("from-the-app", ME, null, "2026-11-21T09:00:00.000Z", [msg("user", "How much did I spend on food?", "2026-11-21T08:59:00Z")]),
  row("consultant", ME, "consultant", "2026-11-22T11:00:00.000Z", [msg("user", "A specialist's thread", "2026-11-22T11:00:00Z")]),
  row("theirs", OTHER, null, "2026-11-22T12:00:00.000Z", [msg("user", "Not mine", "2026-11-22T12:00:00Z")]),
];

test("the list: this person's main conversations, newest first, the app's among them, no specialist and no one else's", async () => {
  const list = await listConversations(fakeDb({ ai_conversations: seed() }), ME);
  assert.deepEqual(list.map((c) => c.id), ["phone", "from-the-app", "desktop"]);
  assert.equal(list[0].title, "Привет! Что там по моему бюджету на сегодня?");
  assert.equal(list[0].updatedAt, "2026-11-22T10:02:46.000Z");
  assert.ok(list.every((c) => c.empty === false));
});

test("the list asks the database for the first line only, never the messages themselves", async () => {
  const db = fakeDb({ ai_conversations: seed() });
  await listConversations(db, ME);
  assert.deepEqual(db.log.map((q) => q.columns), ["id, updated_at, first:messages->0->>content"]);
  // a thread of the real kind: dozens of long messages. The list must not carry them.
  const long = Array.from({ length: 40 }, (_, i) => msg(i % 2 ? "assistant" : "user", `message ${i} `.padEnd(600, "·"), "2026-11-20T10:00:00Z"));
  const tables = { ai_conversations: [row("long", ME, null, "2026-11-22T10:00:00.000Z", long)] };
  const text = JSON.stringify(await listConversations(fakeDb(tables), ME));
  assert.ok(text.length < 300, `a list entry for a 40-message thread is ${text.length} bytes`);
  assert.ok(!text.includes("message 1 "), "no later message is in it");
});

test("at most LIST_LIMIT, newest first", async () => {
  const many = Array.from({ length: LIST_LIMIT + 7 }, (_, i) =>
    row(`c${String(i).padStart(2, "0")}`, ME, null, new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(), [msg("user", `q${i}`, "2026-11-01T00:00:00Z")]));
  const list = await listConversations(fakeDb({ ai_conversations: many }), ME);
  assert.equal(list.length, LIST_LIMIT);
  assert.equal(list[0].id, `c${LIST_LIMIT + 6}`);
});

test("a conversation with nothing in it is listed as 'New conversation', and marked empty", async () => {
  const list = await listConversations(fakeDb({ ai_conversations: [...seed(), row("blank", ME, null, "2026-11-22T12:30:00.000Z", [])] }), ME);
  assert.deepEqual([list[0].id, list[0].title, list[0].empty], ["blank", EMPTY_TITLE, true]);
});

test("a failed read is null, not an empty list: the screen can say it could not load", async () => {
  const broken = { from: () => ({ select: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: "down" } }) }) }) }) }) }) };
  assert.equal(await listConversations(broken, ME), null);
});

test("the title is the first line, squashed, cut at 70 characters, never in the middle of an emoji", () => {
  assert.equal(conversationTitle("Hello"), "Hello");
  assert.equal(conversationTitle("  first   line  with   gaps \nsecond line"), "first line with gaps");
  assert.equal(conversationTitle("\n\n  \nthe first line that is not blank\nrest"), "the first line that is not blank");
  assert.equal(conversationTitle("line one\r\nline two"), "line one");
  assert.equal(conversationTitle(""), EMPTY_TITLE);
  assert.equal(conversationTitle(null), EMPTY_TITLE);
  assert.equal(conversationTitle("   \n \t "), EMPTY_TITLE);
  const exact = "x".repeat(70);
  assert.equal(conversationTitle(exact), exact, "70 characters stay whole");
  assert.equal(conversationTitle(exact + "y"), exact + "…");
  // an emoji is two UTF-16 units: a cut by units would split it at position 70
  const emoji = "x".repeat(69) + "🎯" + "tail";
  const cut = conversationTitle(emoji);
  assert.equal(cut, "x".repeat(69) + "🎯…");
  assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])/.test(cut), "no half of a surrogate pair");
});

test("opening one: it must be this person's own main conversation; anything else is 'not there'", async () => {
  const db = fakeDb({ ai_conversations: seed() });
  assert.equal((await openConversation(db, ME, "desktop")).messages.length, 2);
  assert.equal(await openConversation(db, ME, "theirs"), null, "someone else's");
  assert.equal(await openConversation(db, ME, "consultant"), null, "a specialist's");
  assert.equal(await openConversation(db, ME, "deleted-on-the-phone"), null, "gone");
});

test("'New' reuses the empty conversation it left behind instead of adding a second", async () => {
  const tables = { ai_conversations: seed() };
  const first = await startConversation(fakeDb(tables), ME);
  assert.equal(tables.ai_conversations.length, 6, "the first New adds one");
  // the person goes back to an older thread through the list, then presses New again
  const second = await startConversation(fakeDb(tables), ME);
  assert.equal(second, first, "the same empty conversation");
  assert.equal(tables.ai_conversations.length, 6, "no second empty row");
  const list = await listConversations(fakeDb(tables), ME);
  assert.equal(list.filter((c) => c.empty).length, 1, "one 'New conversation' in the list, not two");
  assert.equal(list[0].id, first, "and it is at the top again");
  assert.equal((await openLatestConversation(fakeDb(tables), ME)).id, first);
});

test("reusing the empty one touches nobody else's empty conversation, and a specialist's empty thread is not taken for it", async () => {
  const tables = {
    ai_conversations: [
      ...seed(),
      row("their-empty", OTHER, null, "2026-11-22T13:00:00.000Z", []),
      row("my-empty-specialist", ME, "lawyer", "2026-11-22T13:30:00.000Z", []),
    ],
  };
  const id = await startConversation(fakeDb(tables), ME);
  assert.notEqual(id, "their-empty");
  assert.notEqual(id, "my-empty-specialist");
  assert.equal(tables.ai_conversations.length, 8, "a new row was made");
  assert.equal(tables.ai_conversations.find((r) => r.id === "their-empty").updated_at, "2026-11-22T13:00:00.000Z", "theirs untouched");
});

test("the page: History opens the list, a pick opens that conversation, and the list is visible even from an empty one", () => {
  const page = fs.readFileSync(new URL("../app/(dashboard)/ai-assistant/page.tsx", import.meta.url), "utf8");
  assert.match(page, /listConversations\(/);
  assert.match(page, /openConversation\(/);
  assert.match(page, /onClick=\{openList\}/);
  // the way back must not depend on there being messages on screen
  const button = page.slice(page.indexOf('key="history"') - 200, page.indexOf('key="history"'));
  assert.match(button, /!historyLoading && \(/);
  assert.ok(!/messages\.length > 0/.test(button), "History is shown from an empty conversation too");
  assert.match(page, /That conversation is no longer there/);
  assert.match(page, /Could not load your conversations/);
});

test("the header: History in the top row; Delete at the left and New at the right of the row beneath; the subtitle stays, shortened, on a phone", () => {
  const page = fs.readFileSync(new URL("../app/(dashboard)/ai-assistant/page.tsx", import.meta.url), "utf8");
  const history = page.indexOf('key="history"');
  const row2 = page.indexOf('key="row2"');
  const del = page.indexOf('title="Delete this conversation"');
  const neu = page.indexOf("onClick={handleNew}");
  assert.ok(history > 0 && history < row2 && row2 < del && del < neu, "History, then the second row: Delete, then New");
  assert.ok(!page.slice(0, row2).includes("onClick={handleNew}"), "New is not in the top row");
  // together, at the right edge: New outermost (the thumb's side), Delete just left of it; the left stays empty
  assert.ok(page.slice(row2, del).includes("flex items-center justify-end gap-2"), "the second row is right-aligned and its buttons touch");
  assert.ok(!page.slice(row2, neu).includes("justify-between"), "not one at each edge");
  // room kept for the fixed usage counter (top right on a phone only)
  assert.ok(page.includes("flex items-center gap-3 pr-20 lg:pr-0"));
  // the title does not wrap; the subtitle is on a phone too, cut to what fits, and whole from sm
  assert.ok(page.includes('whitespace-nowrap">AI Assistant'));
  assert.ok(page.includes('<span className="sm:hidden">Powered by Claude</span>'));
  assert.ok(page.includes('<span className="hidden sm:inline">Powered by Claude · Your personal finance advisor</span>'));
});

test("the screen is as tall as what is visible (dvh), and scrolling to the end moves the message area only, never the window", () => {
  const page = fs.readFileSync(new URL("../app/(dashboard)/ai-assistant/page.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.ok(page.includes('className="chat-screen flex flex-col"'));
  assert.ok(!page.includes("100vh"), "no screen height sized by 100vh in the page");
  assert.ok(css.includes("height: calc(100dvh - 80px);") && css.includes("height: calc(100vh - 80px);"), "dvh, with vh as the fallback");
  assert.ok(!page.includes("scrollIntoView"), "scrollIntoView also scrolls the window");
  assert.ok(page.includes("el.scrollTo({ top: el.scrollHeight"), "the message area is scrolled by itself");
});

test("the input row stands an ordinary distance above the tab bar; the feedback button is lifted above it on the assistant only; the specialist pages keep room at the end instead", () => {
  const page = fs.readFileSync(new URL("../app/(dashboard)/ai-assistant/page.tsx", import.meta.url), "utf8");
  const feedback = fs.readFileSync(new URL("../components/ui/FeedbackButton.tsx", import.meta.url), "utf8");
  const shell = fs.readFileSync(new URL("../components/neurooffice/AgentPageShell.tsx", import.meta.url), "utf8");
  // the 160px gap is gone: the row has an ordinary bottom padding
  assert.ok(page.includes('className="px-4 pt-4 pb-3 lg:pb-4"'));
  assert.ok(!page.includes("pb-20 lg:pb-4"), "the old gap kept for the feedback button");
  // the button: higher on the assistant's route only, where it was everywhere else, and it is still the feedback button
  assert.ok(feedback.includes('pathname === "/ai-assistant"'));
  assert.ok(feedback.includes('"bottom-[168px] lg:bottom-24" : "bottom-24 lg:bottom-6"'));
  assert.ok(feedback.includes('aria-label="Send Feedback"'));
  // the specialist pages: their input ends the page, so the end of the page stands clear of the button
  assert.ok(shell.includes('<div className="p-6 pb-20 lg:pb-24 max-w-3xl mx-auto">'));
  // and nothing moves the send button: it stays where it was
  assert.ok(page.includes('className="w-11 h-11 rounded-2xl gold-gradient'));
});

test("the arithmetic the lifted button rests on: its bottom is above the top of the input row, with a gap, on a phone and on a desktop", () => {
  const phoneRowTop = 80 /* main's bottom padding, over the tab bar */ + 16 + 48 + 12 + 1; // padding-top + row + padding-bottom + border
  const desktopRowTop = 0 + 16 + 48 + 16 + 1;
  assert.ok(168 - phoneRowTop >= 8, `phone: gap ${168 - phoneRowTop}px`);
  assert.ok(96 - desktopRowTop >= 8, `desktop: gap ${96 - desktopRowTop}px`);
  // the specialist page: the end of the page (80px of main's padding + pb-20) is above the button's top (148px)
  assert.ok(80 + 80 >= 148 + 8, "phone: the page ends above the button");
  assert.ok(96 >= 76 + 8, "desktop: the page ends above the button");
});
