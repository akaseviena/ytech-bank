import test from "node:test";
import assert from "node:assert/strict";
import { runwayDays, runwayText } from "./runway.ts";

const base = { balancePence: 100000, expensePence: 30000, expenseCount: 12, historyDays: 60 };

test("a solid month gives the plain answer: 1000.00 at 300.00 a month is 100 days", () => {
  assert.equal(runwayDays(base), 100);
  assert.equal(runwayText(base), "100 days, at the pace of the last 30 days");
});

test("the case that was shown: £1135 with two small payments is withheld, not 5675 days", () => {
  const thin = { balancePence: 113500, expensePence: 600, expenseCount: 2, historyDays: 90 };
  assert.equal(runwayDays(thin), null);
  assert.match(runwayText(thin), /^not available/);
  assert.match(runwayText(thin), /Do not estimate it yourself/);
});

test("less than a month of history is withheld however many payments there are", () => {
  assert.equal(runwayDays({ ...base, historyDays: 29 }), null);
  assert.equal(runwayDays({ ...base, historyDays: 30 }), 100);
});

test("the payment count boundary: 9 withheld, 10 shown", () => {
  assert.equal(runwayDays({ ...base, expenseCount: 9 }), null);
  assert.equal(runwayDays({ ...base, expenseCount: 10 }), 100);
});

test("a very long runway is said as 'more than a year'", () => {
  const long = { balancePence: 1_000_000, expensePence: 10_000, expenseCount: 10, historyDays: 40 }; // 3000 days
  assert.equal(runwayDays(long), 3000);
  assert.equal(runwayText(long), "more than a year, at the pace of the last 30 days");
  // 365 days exactly is still a number
  assert.equal(runwayText({ ...long, balancePence: 121_667 }), "365 days, at the pace of the last 30 days");
});

test("an empty or overdrawn balance is 0 days", () => {
  assert.equal(runwayDays({ ...base, balancePence: 0 }), 0);
  assert.equal(runwayDays({ ...base, balancePence: -500 }), 0);
});

test("no spending in the window gives nothing to divide by", () => {
  assert.equal(runwayDays({ ...base, expensePence: 0, expenseCount: 0 }), null);
});
