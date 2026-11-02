// Runway: how many days the balance lasts at the pace of the last 30 days.
//
// A figure like this is only as good as the history under it. Two test transfers
// of £3 on a £1135 balance "give" 5675 days — fifteen years — which a person will
// screenshot as advice. So the line is withheld when the sample is thin: less than
// a month of history on the account, or fewer than RUNWAY_MIN_EXPENSES expenses in
// the window. A very long runway is reported as "more than a year", not as a number
// of days.
//
// All money is integer pence; the one division is balance * 30 / expenses.
//
// Erasable TypeScript only, so `node --test` can run lib/runway.test.mjs against
// this file directly.

export const RUNWAY_WINDOW_DAYS = 30;
export const RUNWAY_MIN_EXPENSES = 10;
export const RUNWAY_MIN_HISTORY_DAYS = 30;
const LONG_RUNWAY_DAYS = 365;

export type RunwayInput = {
  balancePence: number;
  /** what the account sent in the last RUNWAY_WINDOW_DAYS days */
  expensePence: number;
  /** how many separate payments that was */
  expenseCount: number;
  /** days since the account's first posting */
  historyDays: number;
};

/** Whole days; null when there is too little history to say anything. */
export function runwayDays(i: RunwayInput): number | null {
  if (i.historyDays < RUNWAY_MIN_HISTORY_DAYS) return null;
  if (i.expenseCount < RUNWAY_MIN_EXPENSES || i.expensePence <= 0) return null;
  if (i.balancePence <= 0) return 0;
  return Math.round((i.balancePence * RUNWAY_WINDOW_DAYS) / i.expensePence);
}

/** The words that follow "Estimated runway: " in the consultant's context. */
export function runwayText(i: RunwayInput): string {
  const days = runwayDays(i);
  if (days === null) {
    return `not available — too little history to estimate (needs ${RUNWAY_MIN_HISTORY_DAYS} days of activity and at least ${RUNWAY_MIN_EXPENSES} expenses in the last ${RUNWAY_WINDOW_DAYS} days). Do not estimate it yourself.`;
  }
  if (days > LONG_RUNWAY_DAYS) return `more than a year, at the pace of the last ${RUNWAY_WINDOW_DAYS} days`;
  return `${days} days, at the pace of the last ${RUNWAY_WINDOW_DAYS} days`;
}
