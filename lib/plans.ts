import type { Plan } from "@/types";

// Plans as this app knows them: a hand-written copy. The first copy is the `plans` table in the
// database (change_plan reads the price from it and nothing else can set one); this file and the
// app's copy are checked against it before a release (`npm run check:plans`, lib/plan-check.ts),
// so a price changed in one place and not the other fails the check instead of being shown.
// lib/money.test.mjs checks these against the price strings in PLAN_INFO.
//
// Monthly plan prices as integer pence.
export const PLAN_PRICE_PENCE: Record<Plan, number> = {
  basic: 0,
  standard: 490,
  travel: 990,
  metal: 1890,
  ultimate: 4490,
  business: 4000,
};

/** Plans a person can switch to themselves. Business is not sold by a button (change_plan answers
 *  NOT_PURCHASABLE); it stays in the list because people are on it. */
export const PLAN_PURCHASABLE: Record<Plan, boolean> = {
  basic: true,
  standard: true,
  travel: true,
  metal: true,
  ultimate: true,
  business: false,
};

/**
 * What switching from `current` to `target` costs, in pence: the new plan's price if it is higher
 * than the current one, otherwise nothing. A downgrade, an equal price and a move to Basic are free,
 * and nothing is paid back. This is the rule change_plan applies in the database; it is here only
 * so a confirmation can say what is about to be charged, and what the server reports having
 * charged (`chargedMinor`) is what is shown afterwards.
 */
export function chargeFor(current: Plan, target: Plan): number {
  return PLAN_PRICE_PENCE[target] > PLAN_PRICE_PENCE[current] ? PLAN_PRICE_PENCE[target] : 0;
}
