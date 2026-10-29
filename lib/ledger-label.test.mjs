import test from "node:test";
import assert from "node:assert/strict";
import { isSubscription } from "./ledger-label.ts";

const base = { sent: true, destKind: "bank_fees", rail: "internal", category: "business", description: "Subscription - Standard plan" };
const is = (over) => isSubscription({ ...base, ...over });

test("a plan charge to bank_fees is a subscription", () => {
  assert.equal(is({}), true);
  assert.equal(is({ description: null, category: "other" }), true);
});

test("imported web history on bank_settlement is a subscription, before and after 015", () => {
  // before 015: text and category were flattened
  assert.equal(is({ destKind: "bank_settlement", rail: "web", category: "other", description: "Migrated from web history" }), true);
  // after 015: original text and category restored
  assert.equal(is({ destKind: "bank_settlement", rail: "web", category: "business", description: "Subscription - Ultimate plan" }), true);
});

test("a category or description marks a system-bound payment as a subscription", () => {
  assert.equal(is({ destKind: "bank_settlement", rail: "internal", category: "subscription", description: null }), true);
  assert.equal(is({ destKind: "bank_settlement", rail: "internal", category: "other", description: "Subscription renewal" }), true);
});

test("other payments to settlement are not named a subscription", () => {
  assert.equal(is({ destKind: "bank_settlement", rail: "internal", category: "other", description: "Withdrawal" }), false);
  assert.equal(is({ destKind: "bank_settlement", rail: "internal", category: "business", description: null }), false);
});

test("payments to people, and anything received, are never subscriptions", () => {
  assert.equal(is({ destKind: "main" }), false);
  assert.equal(is({ destKind: undefined }), false);
  assert.equal(is({ sent: false }), false);
  assert.equal(is({ sent: false, destKind: "bank_settlement", rail: "web" }), false);
  assert.equal(is({ destKind: "main", description: "Subscription - to my friend" }), false);
});
