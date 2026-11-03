import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";
import { CONTEXT_AGENTS, CONTEXT_FIELDS, NEVER_SENT } from "./context-fields.ts";

// The promise on /privacy is a list of things that are never sent (NEVER_SENT in
// lib/context-fields.ts). This test is what makes the list a fact rather than a claim:
// a person is seeded with absurd values for every one of those things, the real context
// builders run for all nine assistants and agents on both surfaces, and not one of the
// strings may appear. When the promise stops being true, this is what fails.
//
// The database is a stand-in (lib/test-support/fake-db.mjs): strict about tables, and it
// returns only the columns a query names, so a query that reaches for a column it should
// not is visible both in the text and in the log of what was selected.

register("./test-support/alias-hooks.mjs", import.meta.url);
// importing the app client needs a URL and a key to exist; nothing is ever sent to them
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "canary-test-key";

const { buildAssistantContext, buildAgentContext } = await import("./mobile/financial-context.ts");
const { buildWebContext } = await import("./web-context.ts");

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  main: "22222222-2222-4222-8222-222222222222",
  counterpartyAccount: "33333333-3333-4333-8333-333333333333",
  counterpartyUser: "55555555-5555-4555-8555-555555555555",
  feeAccount: "44444444-4444-4444-8444-444444444444",
};

// Values nobody would type by accident. Each is checked in its parts too.
const CANARY = {
  firstName: "Wobblenut",
  lastName: "Ptarmigan",
  email: "canary-7731@xqz-canary.invalid",
  emailHost: "xqz-canary",
  phone: "+999 555 0173",
  dateOfBirth: "1901-02-03",
  cardNumber: "4111999988887777",
  cardHolder: "WOBBLENUT PTARMIGAN",
  accountNumber: "YT777000777",
  ownIban: "GB00 OWNR 5252 6161",
  counterpartyFirst: "Zxqvortex",
  counterpartyLast: "Quillfeather",
  counterpartyIban: "GB00 CNRY 9090 7777",
  oldRailBalance: "7654.32", // profiles.balance, the column the old rail left behind
  noteSent: "To Zxqvortex Quillfeather",
  noteReceived: "Thanks from Zxqvortex Quillfeather, love to Wobblenut",
  noteTyped: "rent for the Quillfeather flat",
  avatar: "avatar-canary-5599",
};
const GOAL_NAME = "Zeppelin Quixotic Fund";
const SUBSCRIPTION_NOTE = "Subscription - Metal plan";

// Everything that must never be in a context, whichever agent it is.
const NEVER = [
  CANARY.firstName, CANARY.lastName, CANARY.email, "canary-7731", CANARY.emailHost, CANARY.phone,
  CANARY.dateOfBirth, CANARY.cardNumber, CANARY.cardHolder, CANARY.accountNumber, CANARY.ownIban, "OWNR",
  CANARY.counterpartyFirst, CANARY.counterpartyLast, CANARY.counterpartyIban, "CNRY",
  CANARY.oldRailBalance, CANARY.noteSent, CANARY.noteReceived, CANARY.noteTyped, CANARY.avatar,
  ids.user, ids.main, ids.counterpartyAccount, ids.counterpartyUser,
];

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
const transfer = (n, o) => ({ id: `aaaaaaaa-0000-4000-8000-00000000000${n}`, status: "completed", rail: "internal", ...o });

function seed() {
  return {
    account_balances: [{ account_id: ids.main, owner_id: ids.user, kind: "main", currency: "GBP", balance_minor: "1234500" }],
    accounts: [
      { id: ids.main, owner_id: ids.user, kind: "main", iban_display: CANARY.ownIban },
      { id: ids.counterpartyAccount, owner_id: ids.counterpartyUser, kind: "main", iban_display: CANARY.counterpartyIban },
    ],
    profiles: [
      {
        id: ids.user, email: CANARY.email, first_name: CANARY.firstName, last_name: CANARY.lastName, phone: CANARY.phone,
        date_of_birth: CANARY.dateOfBirth, plan: "metal", avatar_url: CANARY.avatar, account_number: CANARY.accountNumber,
        currency: "GBP", card_frozen: false, card_color: "blue", balance: CANARY.oldRailBalance,
      },
      { id: ids.counterpartyUser, email: "other@xqz-canary.invalid", first_name: CANARY.counterpartyFirst, last_name: CANARY.counterpartyLast, plan: "basic" },
    ],
    cards: [{ id: "cccccccc-0000-4000-8000-000000000001", owner_id: ids.user, number: CANARY.cardNumber, cvc: "913", holder_name: CANARY.cardHolder, status: "active" }],
    transfers: [
      transfer(1, { from_account: ids.main, to_account: ids.counterpartyAccount, amount_minor: "2500", category: "food", description: CANARY.noteSent, created_at: hoursAgo(5) }),
      transfer(2, { from_account: ids.counterpartyAccount, to_account: ids.main, amount_minor: "1000", category: "other", description: CANARY.noteReceived, created_at: hoursAgo(6) }),
      transfer(3, { from_account: ids.main, to_account: ids.counterpartyAccount, amount_minor: "700", category: "business", description: CANARY.noteTyped, created_at: hoursAgo(7) }),
      transfer(4, { from_account: ids.main, to_account: ids.feeAccount, amount_minor: "1890", category: "business", rail: "bank_settlement", description: SUBSCRIPTION_NOTE, created_at: hoursAgo(8) }),
    ],
    savings_goals: [{ id: "gggggggg-0000-4000-8000-000000000001", user_id: ids.user, name: GOAL_NAME, emoji: "🎯", target_amount: 5000, current_amount: 125.5, deadline: "2027-01-01" }],
  };
}

const leaks = (text, strings) => strings.filter((s) => text.toLowerCase().includes(s.toLowerCase()));

// one context per surface and agent, each with its own database so its queries can be read back
async function collect() {
  const out = [];
  for (const agent of CONTEXT_AGENTS) {
    let db = fakeDb(seed());
    const app = agent === "assistant" ? await buildAssistantContext(ids.user, db) : await buildAgentContext(ids.user, agent, db);
    out.push({ surface: "app", agent, text: `${app.system}\n${app.live}`, queries: db.log });
    db = fakeDb(seed());
    out.push({ surface: "web", agent, text: await buildWebContext(db, ids.user, agent), queries: db.log });
  }
  return out;
}
const contexts = await collect();
const label = (c) => `${c.surface}/${c.agent}`;

test("the seeded person really is in the stand-in database, and the contexts are real", () => {
  assert.equal(contexts.length, CONTEXT_AGENTS.length * 2);
  for (const c of contexts) assert.match(c.text, /12345\.00|12,345\.00/, `${label(c)} has the balance`);
  for (const c of contexts.filter((x) => x.agent === "assistant")) {
    assert.match(c.text, /Sent £25\.00/, `${label(c)} lists transfers`);
  }
});

test("NEVER-SENT: none of the seeded names, contact details, card, ids, old-rail balance or typed notes reaches any of the nine, on either surface", () => {
  const found = contexts.flatMap((c) => leaks(c.text, NEVER).map((s) => `${label(c)} contains "${s}"`));
  assert.deepEqual(found, []);
});

test("the savings-goal name is sent to exactly the agents whose fields include goals, and to no one else", () => {
  for (const c of contexts) {
    const expected = CONTEXT_FIELDS[c.agent].includes("goals");
    assert.equal(c.text.includes(GOAL_NAME), expected, `${label(c)}: goal name ${expected ? "should be" : "must not be"} present`);
  }
});

test("the only note that reaches a model is the app's own subscription text, and only for agents that list transfers", () => {
  for (const c of contexts) {
    const expected = CONTEXT_FIELDS[c.agent].includes("recent_transfers");
    assert.equal(c.text.includes(SUBSCRIPTION_NOTE), expected, `${label(c)}: subscription note`);
  }
});

test("queries: never select *, never touch cards or accounts, profiles only for the plan, transfer notes only where transfers are listed", () => {
  const allowedColumns = {
    profiles: ["plan"],
    savings_goals: ["name", "emoji", "target_amount", "current_amount", "deadline"],
    account_balances: ["account_id", "balance_minor", "currency"],
  };
  const transferColumns = ["id", "from_account", "to_account", "amount_minor", "category", "rail", "status", "created_at"];
  for (const c of contexts) {
    const listsTransfers = CONTEXT_FIELDS[c.agent].includes("recent_transfers");
    for (const q of c.queries) {
      const cols = q.columns.split(",").map((s) => s.trim());
      assert.ok(!cols.includes("*"), `${label(c)} selects * from ${q.table}`);
      if (q.table === "transfers") {
        for (const col of cols) {
          const ok = transferColumns.includes(col) || (col === "description" && listsTransfers);
          assert.ok(ok, `${label(c)} selects transfers.${col}`);
        }
      } else {
        assert.ok(q.table in allowedColumns, `${label(c)} reads table ${q.table}`);
        for (const col of cols) assert.ok(allowedColumns[q.table].includes(col), `${label(c)} selects ${q.table}.${col}`);
      }
    }
  }
});

test("an agent given the balance alone reads nothing but the balance", () => {
  for (const c of contexts.filter((x) => CONTEXT_FIELDS[x.agent].join() === "balance")) {
    assert.deepEqual([...new Set(c.queries.map((q) => q.table))], ["account_balances"], label(c));
  }
});

test("the detector can find a seeded string, whatever its case", () => {
  assert.deepEqual(leaks("Name: WOBBLENUT p.", NEVER), [CANARY.firstName]);
  assert.deepEqual(leaks("Balance: £12345.00", NEVER), []);
  assert.ok(NEVER_SENT.length >= 4, "the promise on /privacy still lists what is never sent");
});
