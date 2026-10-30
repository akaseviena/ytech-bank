import test from "node:test";
import assert from "node:assert/strict";
import {
  windowHistory,
  ASSISTANT_HISTORY_WINDOW,
  AGENT_HISTORY_WINDOW,
  OLD_REPLY_MAX_CHARS,
  KEEP_UNTOUCHED_TAIL,
  SHORTENED_NOTE,
} from "./history-window.ts";

// n saved messages, alternating, opening with the person: user, assistant, user, ...
// Each text is exactly the length asked for (a short "A7:" label, then filler).
const text = (tag, i, len) => { const label = `${tag}${i}:`; return label + tag.repeat(Math.max(0, len - label.length)); };
const convo = (n, assistantLen = 100, userLen = 40) =>
  Array.from({ length: n }, (_, i) =>
    i % 2 === 0
      ? { role: "user", content: text("U", i, userLen) }
      : { role: "assistant", content: text("A", i, assistantLen) });

test("the windows are the agreed numbers", () => {
  assert.equal(ASSISTANT_HISTORY_WINDOW, 12);
  assert.equal(AGENT_HISTORY_WINDOW, 20);
  assert.equal(OLD_REPLY_MAX_CHARS, 1500);
  assert.equal(KEEP_UNTOUCHED_TAIL, 2);
});

test("a short conversation is sent whole and unchanged", () => {
  const h = convo(6);
  assert.deepEqual(windowHistory(h, ASSISTANT_HISTORY_WINDOW), h);
});

test("only the last `window` saved messages are sent, in order, opening with the person", () => {
  const h = convo(40);
  const out = windowHistory(h, ASSISTANT_HISTORY_WINDOW);
  assert.equal(out.length, 12);
  assert.deepEqual(out, h.slice(-12));
  assert.equal(out[0].role, "user");
  assert.equal(windowHistory(convo(60), AGENT_HISTORY_WINDOW).length, 20);
});

test("a cut that lands on an assistant reply drops it so the thread opens with the person", () => {
  const h = convo(41); // odd: ends on a user message, last 12 begin with an assistant reply
  const out = windowHistory(h, 12);
  assert.equal(out[0].role, "user");
  assert.equal(out.length, 11);
  assert.deepEqual(out, h.slice(-11));
});

test("old long assistant replies are shortened; the last two messages are not", () => {
  const h = convo(30, 3000);
  const out = windowHistory(h, 12);
  const sent = out.map((m) => m.content.length);
  // the final two messages (user, assistant) are exactly as saved
  assert.deepEqual(out.slice(-2), h.slice(-2));
  assert.equal(out.at(-1).content.length, 3000);
  // every earlier assistant reply is shortened to the limit plus the note
  for (const m of out.slice(0, -KEEP_UNTOUCHED_TAIL).filter((m) => m.role === "assistant")) {
    assert.ok(m.content.length <= OLD_REPLY_MAX_CHARS + SHORTENED_NOTE.length, `${m.content.length}`);
    assert.ok(m.content.endsWith(SHORTENED_NOTE));
  }
  assert.ok(sent.reduce((a, b) => a + b, 0) < 12 * 3000 / 2);
});

test("the person's own messages are never shortened, however long", () => {
  const h = convo(20, 100, 5000);
  const out = windowHistory(h, 12);
  assert.ok(out.filter((m) => m.role === "user").every((m) => m.content.length === 5000));
});

test("the limit is inclusive: 1500 characters stay, 1501 are shortened", () => {
  const mk = (len) => [
    { role: "user", content: "q" }, { role: "assistant", content: "a".repeat(len) },
    { role: "user", content: "q2" }, { role: "assistant", content: "short" },
  ];
  assert.equal(windowHistory(mk(1500), 12)[1].content.length, 1500);
  assert.ok(windowHistory(mk(1501), 12)[1].content.endsWith(SHORTENED_NOTE));
});

test("a short old assistant reply is left alone", () => {
  const h = convo(20, 1400);
  assert.deepEqual(windowHistory(h, 12), h.slice(-12));
});

test("the saved conversation is never modified", () => {
  const h = convo(30, 3000);
  const before = JSON.stringify(h);
  const out = windowHistory(h, 12);
  assert.equal(JSON.stringify(h), before);
  assert.ok(out.some((m) => m.content.endsWith(SHORTENED_NOTE))); // it did shorten something in the copy
});

test("shortening never leaves half an emoji", () => {
  // 1499 ASCII characters then an emoji: the 1500-character cut would fall inside the pair
  const text = "a".repeat(1499) + "😀" + "b".repeat(2000);
  const h = [{ role: "user", content: "q" }, { role: "assistant", content: text }, { role: "user", content: "q2" }, { role: "assistant", content: "ok" }];
  const out = windowHistory(h, 12)[1].content;
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out), "lone high surrogate");
  assert.ok(out.endsWith(SHORTENED_NOTE));
});

test("bad window sizes are rejected", () => {
  for (const w of [0, -1, 1.5, NaN]) assert.throws(() => windowHistory(convo(4), w));
});

test("the point of it: the request stops growing with the length of the conversation", () => {
  const size = (n, w) => windowHistory(convo(n, 3000), w).reduce((a, m) => a + m.content.length, 0);
  assert.equal(size(100, 12), size(400, 12)); // 100 or 400 saved messages: same amount sent
  assert.ok(size(40, 20) > size(40, 12)); // agents get the larger window
  const whole = convo(40, 3000).reduce((a, m) => a + m.content.length, 0);
  assert.ok(size(40, 12) < whole / 4, `${size(40, 12)} vs ${whole}`);
});
