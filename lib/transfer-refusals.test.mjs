import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

// What a person is told when post_transfer refuses a payment because their card is frozen. The
// rule itself lives in the database function (the one place both apps and the plan charge go
// through); these tests are about the routes that call it: each must pass the reason on, in words,
// instead of the general "transfer failed".

register("./test-support/alias-hooks.mjs", import.meta.url);
register("./test-support/route-hooks.mjs", import.meta.url);

const transferRoute = await import("../app/api/mobile/transfer/route.ts");
const subscriptionRoute = await import("../app/api/subscription/route.ts");

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const MAIN = "22222222-2222-4222-8222-222222222222";
const OTHER_ACCOUNT = "33333333-3333-4333-8333-333333333333";
const FEES = "44444444-4444-4444-8444-444444444444";

function setup(postTransfer) {
  const tables = {
    profiles: [{ id: USER.id, plan: "basic" }],
    accounts: [
      { id: MAIN, owner_id: USER.id, kind: "main", is_system: false },
      { id: OTHER_ACCOUNT, owner_id: "99999999-9999-4999-8999-999999999999", kind: "main", is_system: false },
      { id: FEES, owner_id: null, kind: "bank_fees", is_system: true },
    ],
    account_balances: [{ account_id: MAIN, balance_minor: "500000" }],
    ai_usage: [],
  };
  const calls = [];
  const db = fakeDb(tables, { rpc: { post_transfer: (args) => { calls.push(args); return postTransfer(args); } } });
  globalThis.__routeTest = { db, user: USER };
  return { tables, calls };
}

const pay = async () => {
  const res = await transferRoute.POST(new Request("http://localhost/api/mobile/transfer", {
    method: "POST",
    headers: { "idempotency-key": "k-1" },
    body: JSON.stringify({ toAccountId: OTHER_ACCOUNT, amountMinor: 1000, category: "food" }),
  }));
  return { status: res.status, json: await res.json() };
};

test("the app's transfer: a frozen card is refused with its reason, when the function answers with a code", async () => {
  setup(() => ({ ok: false, code: "CARD_FROZEN" }));
  const r = await pay();
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "CARD_FROZEN");
  assert.match(r.json.message, /card is frozen/i);
  assert.notEqual(r.json.message, "Transfer failed.");
});

test("the app's transfer: the same when the function raises it as a database exception", async () => {
  setup(() => { throw Object.assign(new Error("some database wording"), { code: "CARD_FROZEN" }); });
  const r = await pay();
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "CARD_FROZEN");
  assert.match(r.json.message, /card is frozen/i, "our wording, not the database's");
});

test("the app's transfer: an ordinary success is unchanged", async () => {
  const w = setup(() => ({ ok: true, transfer_id: "t-1" }));
  const r = await pay();
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(w.calls.length, 1);
});

test("changing plan with a frozen card says so, and does not change the plan", async () => {
  const w = setup(() => ({ ok: false, code: "CARD_FROZEN" }));
  const res = await subscriptionRoute.POST(new Request("http://localhost/api/subscription", {
    method: "POST",
    body: JSON.stringify({ plan: "metal", requestId: "55555555-5555-4555-8555-555555555555" }),
  }));
  const json = await res.json();
  assert.equal(res.status, 400);
  assert.equal(json.code, "CARD_FROZEN");
  assert.match(json.error, /card is frozen/i);
  assert.equal(w.tables.profiles[0].plan, "basic");
});
