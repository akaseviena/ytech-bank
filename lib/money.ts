// Money in this app is an integer number of pence. A float never holds money.
//
// The ledger stores pence (bigint). The only two crossings live in this file:
//   in  — poundsToPence("12.34") === 1234   parses the digits; no arithmetic
//   out — formatPence(1234) === "£12.34"    the one division by 100 is splitPence
//
// Do not write `x * 100` or `x / 100` anywhere else: 0.29 * 100 is
// 28.999999999999996 and 18.9 * 100 is 1889.9999999999998 (the Metal price).
//
// Erasable TypeScript only (no enums / namespaces / parameter properties) so
// `node --test` can run lib/money.test.mjs against this file directly.

export type Pence = number;

// Plain decimal only: up to 9 pound digits, optional 1–2 pence digits.
// No sign, no exponent, no thousands separators, no bare "5." or ".5".
const AMOUNT = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

/** "12.34" -> 1234. Returns null for anything that is not a plain amount. */
export function poundsToPence(input: string): Pence | null {
  const m = AMOUNT.exec(input.trim());
  if (!m) return null;
  // Concatenate digits ("12" + "34"); never multiply.
  return Number(m[1] + (m[2] ?? "").padEnd(2, "0"));
}

/**
 * A pound-denominated numeric column that the app still reads as a JS number
 * (savings_goals.target_amount / current_amount). Goes through the same string
 * parser so it cannot pick up float error. Throws rather than guessing.
 */
export function numericToPence(value: number): Pence {
  const pence = Number.isFinite(value) ? poundsToPence(value.toFixed(2)) : null;
  if (pence === null) throw new Error(`Not a non-negative amount in pounds: ${value}`);
  return pence;
}

/**
 * A bigint ledger column as PostgREST returns it (a string, to survive past
 * 2^53) -> pence. Throws on anything that is not a safe integer, so a bad
 * value stops the page instead of showing a wrong balance.
 */
export function ledgerPence(value: unknown): Pence {
  if (typeof value === "string") {
    if (!/^-?\d+$/.test(value)) throw new Error(`Not a pence integer: ${JSON.stringify(value)}`);
    value = Number(value);
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`Not a pence integer: ${JSON.stringify(value)}`);
  }
  return value;
}

/** The single place pence are split into pounds and pence. */
function splitPence(p: Pence): { negative: boolean; pounds: number; pence: number } {
  if (!Number.isSafeInteger(p)) throw new Error(`Not a pence integer: ${p}`);
  const abs = Math.abs(p);
  const pence = abs % 100;
  return { negative: p < 0, pounds: (abs - pence) / 100, pence };
}

/** 1234 -> "12.34", -5 -> "-0.05". Exact decimal text for numeric columns. */
export function penceToPoundsString(p: Pence): string {
  const s = splitPence(p);
  return `${s.negative ? "-" : ""}${s.pounds}.${String(s.pence).padStart(2, "0")}`;
}

/** 123456 -> "£1,234.56", -300 -> "-£3.00". The only display formatter for ledger money. */
export function formatPence(p: Pence): string {
  const s = splitPence(p);
  return `${s.negative ? "-" : ""}£${s.pounds.toLocaleString("en-GB")}.${String(s.pence).padStart(2, "0")}`;
}
