import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { demoCardNumber, isLuhnValid } from "./card.ts";

test("the Luhn checker itself is right (known cards and one-digit changes)", () => {
  assert.equal(isLuhnValid("4111111111111111"), true);  // well-known test Visa
  assert.equal(isLuhnValid("4111111111111112"), false);
  assert.equal(isLuhnValid("5500005555555559"), true);  // well-known test Mastercard
  assert.equal(isLuhnValid("5500005555555558"), false);
  assert.equal(isLuhnValid("0000000000000000"), true);  // all zeros passes — why a plain placeholder would not do
  assert.equal(isLuhnValid("12a4"), false);
});

test("demo number: 16 digits, leading 0, deterministic", () => {
  const id = "e96fc150-fec1-4300-b181-c01f710fa53f";
  const n = demoCardNumber(id);
  assert.match(n, /^0\d{15}$/);
  assert.equal(demoCardNumber(id), n);
  assert.equal(demoCardNumber(id.toUpperCase()), n);
});

test("demo number never passes the Luhn check, for any account id", () => {
  for (let i = 0; i < 20000; i++) {
    const n = demoCardNumber(crypto.randomUUID());
    assert.equal(isLuhnValid(n), false, `${n} passed Luhn`);
    assert.equal(n.length, 16);
    assert.equal(n[0], "0");
  }
});

test("different accounts get different numbers and different last four digits", () => {
  const ids = Array.from({ length: 2000 }, () => crypto.randomUUID());
  const numbers = new Set(ids.map(demoCardNumber));
  const last4 = new Set(ids.map((id) => demoCardNumber(id).slice(-4)));
  assert.equal(numbers.size, 2000);
  assert.ok(last4.size > 1500, `only ${last4.size} distinct last-4 groups`);
});

test("it is not derived from the public identifiers", () => {
  const id = "e96fc150-fec1-4300-b181-c01f710fa53f";
  assert.notEqual(demoCardNumber(id).slice(-8), "44758604");
  assert.throws(() => demoCardNumber("GB62 YTEC 44758604"));
  assert.throws(() => demoCardNumber("YT915640142"));
});
