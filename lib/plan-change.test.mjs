import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

// Changing a plan: the web route, the app's route, the plan table the server publishes and the
// pre-release check against it. The charge itself is done by the database function
// change_plan(p_request_id, p_target) (migration 022), which reads who is asking from the session
// it is called with; here it is a stand-in, so what is tested is what each route does with every
// answer, and the rule the confirmation dialog quotes.

register("./test-support/alias-hooks.mjs", import.meta.url);
register("./test-support/route-hooks.mjs", import.meta.url);

const mobileRoute = await import("../app/api/mobile/subscription/route.ts");
const webRoute = await import("../app/api/subscription/route.ts");
const plansRoute = await import("../app/api/mobile/plans/route.ts");
const { PLAN_PRICE_PENCE, PLAN_PURCHASABLE, chargeFor } = await import("./plans.ts");
const { comparePlans } = await import("./plan-check.ts");
const { PLAN_REFUSALS } = await import("./plan-change.ts");

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const REQ = "55555555-5555-4555-8555-555555555555";

function setup(changePlan, { user = USER, plans = [] } = {}) {
  const calls = [];
  const tables = { ai_usage: [], plans };
  const db = fakeDb(tables, { rpc: { change_plan: (args) => { calls.push(args); return changePlan(args); } } });
  globalThis.__routeTest = { db, user };
  return { calls, tables, db };
}
// The success shape is the one agreed for 022; the live function's has to be confirmed against it.
const ok = (over = {}) => ({ ok: true, replayed: false, plan: "travel", balance_minor: "250000", charged_minor: 990, ...over });

const asApp = async (body, headers = {}) => {
  const res = await mobileRoute.POST(new Request("http://localhost/api/mobile/subscription", { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};
const onWeb = async (body) => {
  const res = await webRoute.POST(new Request("http://localhost/api/subscription", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

// ── the rule ──────────────────────────────────────────────────────────────────

test("the rule: only a switch to a higher price is charged, and then the new plan's whole price", () => {
  const plans = Object.keys(PLAN_PRICE_PENCE);
  for (const from of plans) {
    for (const to of plans) {
      const expected = PLAN_PRICE_PENCE[to] > PLAN_PRICE_PENCE[from] ? PLAN_PRICE_PENCE[to] : 0;
      assert.equal(chargeFor(from, to), expected, `${from} -> ${to}`);
    }
  }
  // the cases a tester will try
  assert.equal(chargeFor("ultimate", "standard"), 0, "a downgrade is free");
  assert.equal(chargeFor("standard", "standard"), 0, "an equal price is free");
  assert.equal(chargeFor("ultimate", "basic"), 0, "so is a move to Basic");
  assert.equal(chargeFor("standard", "travel"), 990, "an upgrade pays the new plan's price, not the difference");
  assert.equal(chargeFor("basic", "ultimate"), 4490);
});

test("Business is the one plan that is not sold by a button", () => {
  assert.deepEqual(Object.entries(PLAN_PURCHASABLE).filter(([, v]) => !v).map(([k]) => k), ["business"]);
});

// ── the app's route ───────────────────────────────────────────────────────────

test("the app: a successful change reports the plan, the balance and what was charged", async () => {
  const w = setup(() => ok());
  const r = await asApp({ plan: "travel", requestId: REQ });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, plan: "travel", balanceMinor: 250000, chargedMinor: 990, replayed: false });
  assert.deepEqual(w.calls, [{ p_request_id: REQ, p_target: "travel" }], "no person and no price in the call: the session says who, the table says what it costs");
});

test("the app: the answer is read by its five keys; a key added later does not break it", async () => {
  setup(() => ({ ...ok(), transfer_id: "t-1", something_new: { a: 1 } }));
  const r = await asApp({ plan: "travel", requestId: REQ });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.json).sort(), ["balanceMinor", "chargedMinor", "ok", "plan", "replayed"], "and nothing extra is passed on");
  for (const missing of ["plan", "balance_minor", "charged_minor"]) {
    const answer = ok();
    delete answer[missing];
    setup(() => answer);
    assert.equal((await asApp({ plan: "travel", requestId: REQ })).status, 500, `no ${missing}: not trusted`);
  }
});

test("the app: a free change says it charged nothing, and a repeat of the request says it was a repeat", async () => {
  setup(() => ok({ plan: "standard", charged_minor: 0 }));
  assert.equal((await asApp({ plan: "standard", requestId: REQ })).json.chargedMinor, 0);
  setup(() => ok({ replayed: true, charged_minor: 0 }));
  const again = await asApp({ plan: "travel", requestId: REQ });
  assert.equal(again.status, 200);
  assert.equal(again.json.replayed, true);
});

test("the app: every refusal keeps its code, in words, with the status the app is told", async () => {
  // the contract: six of change_plan's own, five passed through from the posting function, and CARD_FROZEN
  const expected = {
    FORBIDDEN: 403, MISSING_REQUEST_ID: 400, UNKNOWN_PLAN: 400, NOT_PURCHASABLE: 400, SAME_PLAN: 409, NO_ACCOUNT: 400,
    INSUFFICIENT_FUNDS: 400, INVALID_AMOUNT: 500, SAME_ACCOUNT: 500, NO_SUCH_ACCOUNT: 500, CURRENCY_MISMATCH: 500,
    CARD_FROZEN: 400,
  };
  assert.deepEqual(Object.keys(PLAN_REFUSALS).sort(), Object.keys(expected).sort(), "the table covers exactly the contract's twelve codes");
  for (const [code, status] of Object.entries(expected)) {
    setup(() => ({ ok: false, code }));
    const r = await asApp({ plan: "business", requestId: REQ });
    assert.equal(r.status, status, code);
    assert.equal(r.json.error, code, "the code is passed on as the database gave it");
    assert.ok(r.json.message.length > 10 && r.json.message !== "Transfer failed.", `${code} has its own words`);
  }
  // a code the guessed names used is NOT one now
  for (const old of ["INVALID_PLAN", "ALREADY_ON_PLAN"]) {
    setup(() => ({ ok: false, code: old }));
    assert.equal((await asApp({ plan: "business", requestId: REQ })).status, 500, `${old} is not in the contract`);
  }
  setup(() => ({ ok: false, code: "CARD_FROZEN" }));
  assert.match((await asApp({ plan: "metal", requestId: REQ })).json.message, /card is frozen/i);
});

test("the app: an answer or an error the route does not know is a failure, not a success", async () => {
  setup(() => ({ ok: false, code: "SOMETHING_NEW" }));
  assert.equal((await asApp({ plan: "metal", requestId: REQ })).status, 500);
  setup(() => { throw Object.assign(new Error("boom"), { code: "XX000" }); });
  assert.equal((await asApp({ plan: "metal", requestId: REQ })).status, 500);
  setup(() => ({ ok: true }));
  assert.equal((await asApp({ plan: "metal", requestId: REQ })).status, 500, "a success without a plan and a balance is not trusted");
});

test("the app: no sign-in, a bad body, or too many attempts never reach the database function", async () => {
  const none = setup(() => ok(), { user: null });
  assert.equal((await asApp({ plan: "travel", requestId: REQ })).status, 401);
  const bad = setup(() => ok());
  assert.equal((await asApp({ plan: "travel", requestId: "not-a-uuid" })).status, 400);
  assert.equal((await asApp({ requestId: REQ })).status, 400);
  const busy = setup(() => ok());
  busy.tables.ai_usage.push(...Array.from({ length: 10 }, () => ({ user_id: USER.id, agent: "transfer", created_at: new Date().toISOString() })));
  assert.equal((await asApp({ plan: "travel", requestId: REQ })).status, 429);
  assert.deepEqual([none.calls.length, bad.calls.length, busy.calls.length], [0, 0, 0]);
});

// ── the web's route ───────────────────────────────────────────────────────────

test("the web: success, free change and refusals, with the texts the settings page matches", async () => {
  setup(() => ok({ plan: "standard", charged_minor: 0 }));
  const free = await onWeb({ plan: "standard", requestId: REQ });
  assert.deepEqual(free.json, { success: true, plan: "standard", balanceMinor: 250000, chargedMinor: 0, replayed: false });

  setup(() => ({ ok: false, code: "INSUFFICIENT_FUNDS" }));
  const poor = await onWeb({ plan: "ultimate", requestId: REQ });
  assert.equal(poor.status, 400);
  assert.equal(poor.json.error, "Insufficient balance", "the settings page tells this one apart by its text");

  setup(() => ({ ok: false, code: "CARD_FROZEN" }));
  const frozen = await onWeb({ plan: "ultimate", requestId: REQ });
  assert.match(frozen.json.error, /card is frozen/i);
  assert.equal(frozen.json.code, "CARD_FROZEN");

  setup(() => ({ ok: false, code: "NOT_PURCHASABLE" }));
  assert.equal((await onWeb({ plan: "business", requestId: REQ })).status, 400);

  setup(() => ok(), { user: null });
  assert.equal((await onWeb({ plan: "travel", requestId: REQ })).status, 401);
});

// ── the plan table the server publishes ───────────────────────────────────────

// rows as the live table has them (migration 022)
const rows = [
  { plan: "basic", name: "Basic", price_minor: 0, price_from: false, purchasable: true, charge_description: null, updated_at: "x", secret: "x" },
  { plan: "standard", name: "Standard", price_minor: "490", price_from: false, purchasable: true, charge_description: "Subscription - Standard plan", updated_at: "x" },
  { plan: "business", name: "Business", price_minor: 4000, price_from: true, purchasable: false, charge_description: null, updated_at: "x" },
];

test("GET /api/mobile/plans publishes the table, public and uncached, naming its columns", async () => {
  const w = setup(() => ok(), { plans: rows, user: null });
  const res = await plansRoute.GET();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const { plans } = await res.json();
  assert.deepEqual(plans.map((p) => p.id), ["basic", "standard", "business"].sort((a, b) => Number(rows.find((r) => r.plan === a).price_minor) - Number(rows.find((r) => r.plan === b).price_minor)));
  assert.deepEqual(plans.find((p) => p.id === "standard"), { id: "standard", label: "Standard", priceMinor: 490, priceFrom: false, purchasable: true, chargeDescription: "Subscription - Standard plan" });
  assert.deepEqual(plans.find((p) => p.id === "business"), { id: "business", label: "Business", priceMinor: 4000, priceFrom: true, purchasable: false, chargeDescription: null });
  assert.ok(plans.every((p) => !("secret" in p) && !("updated_at" in p)), "nothing but the named columns");
  assert.deepEqual(w.db.log.map((q) => q.columns), ["plan, name, price_minor, price_from, purchasable, charge_description"]);
});

// ── the pre-release check ─────────────────────────────────────────────────────

const published = (over = {}) => [
  { id: "basic", label: "Basic", priceMinor: 0, priceFrom: false, purchasable: true, chargeDescription: null },
  { id: "standard", label: "Standard", priceMinor: 490, priceFrom: false, purchasable: true, chargeDescription: "Subscription - Standard plan" },
  { id: "travel", label: "Travel", priceMinor: 990, priceFrom: false, purchasable: true, chargeDescription: "Subscription - Travel plan" },
  { id: "metal", label: "Metal", priceMinor: 1890, priceFrom: false, purchasable: true, chargeDescription: "Subscription - Metal plan" },
  { id: "ultimate", label: "Ultimate", priceMinor: 4490, priceFrom: false, purchasable: true, chargeDescription: "Subscription - Ultimate plan" },
  { id: "business", label: "Business", priceMinor: 4000, priceFrom: true, purchasable: false, chargeDescription: null },
].map((p) => ({ ...p, ...(over[p.id] ?? {}) }));
const local = { prices: PLAN_PRICE_PENCE, purchasable: PLAN_PURCHASABLE };

test("the check: the copy in lib/plans.ts agrees with the table as agreed", () => {
  assert.deepEqual(comparePlans(published(), local), []);
});

test("the check: a price, a plan, a sold-or-not flag or a note that differs by one character is reported", () => {
  assert.match(comparePlans(published({ standard: { priceMinor: 500 } }), local).join(), /"standard" costs 500 on the server and 490 here/);
  assert.match(comparePlans([...published(), { id: "gold", label: "Gold", priceMinor: 1, chargeDescription: null }], local).join(), /server has the plan "gold"/);
  assert.match(comparePlans(published().filter((p) => p.id !== "metal"), local).join(), /this copy has the plan "metal"/);
  assert.match(comparePlans(published({ business: { purchasable: true, chargeDescription: "Subscription - Business plan" } }), local).join(), /"business" is purchasable on the server and not purchasable here/);
  assert.match(comparePlans(published({ travel: { chargeDescription: null } }), local).join(), /"travel" has no charge note/);
  assert.match(comparePlans(published({ business: { chargeDescription: "Subscription - Business plan" } }), local).join(), /"business" has a charge note/);
  for (const bad of ["Subscription - Standard plan ", "Subscription – Standard plan", "subscription - standard plan", "Subscription - Standard Plan"]) {
    assert.match(comparePlans(published({ standard: { chargeDescription: bad } }), local).join(), /not one the AI-context filter recognises/, JSON.stringify(bad));
  }
});

test("the script: exits 0 against a server that agrees and 1, saying what, against one that does not", async () => {
  const serve = (plans) => new Promise((resolve) => {
    const server = http.createServer((req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ plans })); });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
  const run = (port) => new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/check-plans.mjs"], { env: { ...process.env, CHECK_BASE_URL: `http://127.0.0.1:${port}` }, cwd: new URL("..", import.meta.url) });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
  for (const [plans, code, pattern] of [
    [published(), 0, /ok: 6 plans/],
    [published({ travel: { priceMinor: 1000 } }), 1, /"travel" costs 1000 on the server and 990 here/],
  ]) {
    const server = await serve(plans);
    const result = await run(server.address().port);
    server.close();
    assert.equal(result.code, code, result.out);
    assert.match(result.out, pattern);
  }
});
