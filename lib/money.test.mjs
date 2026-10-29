// Run with: npm test   (node's built-in runner; no extra dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import {
  poundsToPence,
  numericToPence,
  ledgerPence,
  penceToPoundsString,
  formatPence,
} from "./money.ts";
import { PLAN_PRICE_PENCE } from "./plans.ts";
import { PLAN_INFO } from "../types/index.ts";

// Known answers, written down by hand — never computed by a second run of the
// same conversion, which would share its error.
const KNOWN = [
  ["0", 0],
  ["1", 100],
  ["0.01", 1],
  ["0.1", 10],
  ["0.29", 29],
  ["12", 1200],
  ["12.3", 1230],
  ["12.34", 1234],
  ["44.90", 4490],
  ["44.9", 4490],
  ["18.90", 1890],
  ["4.90", 490],
  ["1.15", 115],
  ["19.99", 1999],
  ["1000", 100000],
  ["999999999.99", 99999999999],
  [" 12.34 ", 1234],
];

test("poundsToPence gives the known answers", () => {
  for (const [input, want] of KNOWN) {
    assert.equal(poundsToPence(input), want, `poundsToPence(${JSON.stringify(input)})`);
  }
});

test("poundsToPence rejects everything that is not a plain amount", () => {
  for (const bad of ["", " ", "abc", "1e3", "-1", "+1", "1.234", ".5", "5.", "1,000", "0x10", "1 2", "NaN", "Infinity", "1000000000"]) {
    assert.equal(poundsToPence(bad), null, `poundsToPence(${JSON.stringify(bad)})`);
  }
});

// These are the values on which `Number(s) * 100` is wrong in JS. If someone
// "optimises" poundsToPence into a multiplication, the first test above fails
// on them. This test pins that the values keep their teeth: if it ever stops
// failing the naive versions, the table has gone soft and needs new values.
// (12.34 is NOT one of them: 12.34 * 100 is exactly 1234 in JS.)
test("the table still discriminates against multiplication", () => {
  const naive = [
    (s) => Number(s) * 100,
    (s) => Math.trunc(Number(s) * 100),
    (s) => Math.floor(Number(s) * 100),
    (s) => parseInt(String(Number(s) * 100), 10),
  ];
  const trap = [["0.29", 29], ["18.90", 1890], ["4.90", 490], ["1.15", 115], ["19.99", 1999]];
  for (const impl of naive) {
    const wrong = trap.filter(([s, want]) => impl(s) !== want);
    assert.ok(wrong.length > 0, `naive conversion ${impl} passed every trap value`);
  }
  assert.equal(12.34 * 100, 1234); // the claim that it breaks 12.34 is false; keep the record
  assert.notEqual(0.29 * 100, 29);
  assert.notEqual(18.9 * 100, 1890);
});

test("numericToPence reads pound-valued numeric columns without float error", () => {
  assert.equal(numericToPence(0.29), 29);
  assert.equal(numericToPence(18.9), 1890);
  assert.equal(numericToPence(12.34), 1234);
  assert.equal(numericToPence(1000), 100000);
  assert.throws(() => numericToPence(-1));
  assert.throws(() => numericToPence(NaN));
});

test("ledgerPence accepts bigint-as-string and rejects non-integers", () => {
  assert.equal(ledgerPence("100000"), 100000);
  assert.equal(ledgerPence("-250"), -250);
  assert.equal(ledgerPence(42), 42);
  for (const bad of ["12.5", "", "abc", null, undefined, 1.5, Number.NaN, "9007199254740993"]) {
    assert.throws(() => ledgerPence(bad), undefined, `ledgerPence(${JSON.stringify(bad)})`);
  }
});

test("display is exact", () => {
  assert.equal(penceToPoundsString(1234), "12.34");
  assert.equal(penceToPoundsString(5), "0.05");
  assert.equal(penceToPoundsString(0), "0.00");
  assert.equal(penceToPoundsString(-5), "-0.05");
  assert.equal(formatPence(0), "£0.00");
  assert.equal(formatPence(5), "£0.05");
  assert.equal(formatPence(1890), "£18.90");
  assert.equal(formatPence(123456), "£1,234.56");
  assert.equal(formatPence(-300), "-£3.00");
  assert.equal(formatPence(100000), "£1,000.00");
});

test("conversion round-trips for every amount up to £50.00", () => {
  for (let p = 0; p <= 5000; p++) {
    assert.equal(poundsToPence(penceToPoundsString(p)), p);
  }
});

test("PLAN_PRICE_PENCE agrees with the price shown in PLAN_INFO", () => {
  for (const [plan, info] of Object.entries(PLAN_INFO)) {
    const m = /£(\d+(?:\.\d{2})?)/.exec(info.price);
    const shown = m ? poundsToPence(m[1]) : 0; // "Free" has no £
    assert.equal(PLAN_PRICE_PENCE[plan], shown, `${plan}: table ${PLAN_PRICE_PENCE[plan]} vs "${info.price}"`);
  }
});
