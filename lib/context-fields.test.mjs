import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTEXT_AGENTS,
  CONTEXT_FIELDS,
  CONTEXT_FIELD_TEXT,
  CONTEXT_AGENT_LABEL,
  contextAgent,
  fieldGroups,
  fieldSet,
} from "./context-fields.ts";

// The layout agreed for the app, written out by hand. If the table changes, this
// test changes with it on purpose: it is the review of what is sent.
const AGREED = {
  assistant: ["plan", "balance", "month_spent", "month_received", "month_categories", "recent_transfers", "goals"],
  accountant: ["balance", "last_transfers_totals", "month_categories"],
  consultant: ["balance", "month_vs_previous", "month_categories", "runway"],
  marketer: ["balance", "month_spent", "month_business_spent"],
  copywriter: ["balance"],
  designer: ["balance"],
  hr: ["balance"],
  client_manager: ["balance"],
  lawyer: ["balance"],
};

test("each assistant and agent gets exactly the agreed fields", () => {
  for (const [agent, fields] of Object.entries(AGREED)) assert.deepEqual([...CONTEXT_FIELDS[agent]], fields, agent);
  assert.deepEqual([...CONTEXT_AGENTS].sort(), Object.keys(AGREED).sort());
});

test("every field is described in words and used by someone", () => {
  const used = new Set(Object.values(CONTEXT_FIELDS).flat());
  for (const field of Object.keys(CONTEXT_FIELD_TEXT)) {
    assert.ok(CONTEXT_FIELD_TEXT[field].length > 10, `${field} has no text`);
    assert.ok(used.has(field), `${field} is described but no agent receives it`);
  }
  for (const field of used) assert.ok(field in CONTEXT_FIELD_TEXT, `${field} is received but not described`);
});

test("the figures in the wording are the ones the collectors use", () => {
  assert.match(CONTEXT_FIELD_TEXT.recent_transfers, /20 most recent/);
  assert.match(CONTEXT_FIELD_TEXT.last_transfers_totals, /50 most recent/);
});

test("only the assistant sees transfers one by one", () => {
  const withList = CONTEXT_AGENTS.filter((a) => CONTEXT_FIELDS[a].includes("recent_transfers"));
  assert.deepEqual(withList, ["assistant"]);
});

test("web and app ids both resolve; an unknown id is refused, not given a default", () => {
  assert.equal(contextAgent("hr-manager"), "hr");
  assert.equal(contextAgent("client-manager"), "client_manager");
  assert.equal(contextAgent("client_manager"), "client_manager");
  assert.equal(contextAgent("accountant"), "accountant");
  assert.throws(() => contextAgent("treasurer"), /No context fields/);
  assert.throws(() => contextAgent("__proto__"), /No context fields/);
});

test("agents with the same fields are listed together: five groups, the last is the balance-only five", () => {
  const groups = fieldGroups();
  assert.equal(groups.length, 5);
  assert.deepEqual(groups[4].agents, ["copywriter", "designer", "hr", "client_manager", "lawyer"]);
  assert.deepEqual([...groups[4].fields], ["balance"]);
  assert.equal(groups.flatMap((g) => g.agents).length, CONTEXT_AGENTS.length);
});

test("fieldSet and labels cover every agent", () => {
  for (const agent of CONTEXT_AGENTS) {
    assert.ok(fieldSet(agent).has("balance"), `${agent} gets the balance`);
    assert.ok(CONTEXT_AGENT_LABEL[agent]);
  }
});

// ── the conversation windows printed on /privacy are the ones the routes use (KL-021)
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("each AI route windows the conversation with the shared constant, never a typed-in number", () => {
  const routes = {
    "app/api/ai/route.ts": "ASSISTANT_HISTORY_WINDOW",
    "app/api/mobile/ai/chat/route.ts": "ASSISTANT_HISTORY_WINDOW",
    "app/api/neurooffice/route.ts": "AGENT_HISTORY_WINDOW",
    "app/api/mobile/ai/neurooffice/route.ts": "AGENT_HISTORY_WINDOW",
  };
  for (const [path, constant] of Object.entries(routes)) {
    const text = src(path);
    assert.ok(text.includes(`import { windowHistory, ${constant} }`), `${path} imports ${constant}`);
    const call = text.slice(text.indexOf("windowHistory("));
    const args = call.slice(0, call.indexOf(");") + 2);
    assert.ok(args.includes(constant), `${path} passes ${constant} to windowHistory`);
    assert.ok(!/,\s*\d+\s*,?\s*\)/.test(args), `${path} passes a literal number to windowHistory`);
  }
});

test("the privacy page prints no window or count of its own: it renders them from the layout", () => {
  const page = src("app/privacy/page.tsx");
  assert.ok(page.includes("layout.conversationWindow.assistant") && page.includes("layout.conversationWindow.specialist"));
  assert.ok(!/last\s+\d+\s+messages|last\s+\d+\s+with|\b(12|20|50)\b\s+(most recent|messages)/i.test(page), "a number is typed into the policy text");
});
