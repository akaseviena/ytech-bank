// The demo card number shown on the virtual card.
//
// There is no issued card yet, so the number is a stand-in. It is derived from
// the ledger account id — never from a public identifier like the account
// reference or the old YT number, which people hand to each other. It is also
// made unmistakably not-a-card on purpose:
//   - it starts with 0, a leading digit no card issuer uses (ISO/IEC 7812);
//   - its last digit is chosen so the number FAILS the Luhn check, so any form
//     that validates card numbers rejects it outright.
// When a card is really issued, the issuer's number replaces this; it is never
// computed.
//
// Dependency-free and erasable TypeScript so lib/card.test.mjs can run it.

/** The digit that would make `partial` (all digits, check digit not yet added) Luhn-valid. */
function luhnCheckDigit(partial: string): number {
  let sum = 0;
  // the check digit will sit to the right, so the rightmost digit of `partial` is doubled first
  for (let i = partial.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = partial.charCodeAt(i) - 48;
    if (double) {
      d += d;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** True when `digits` passes the Luhn check. */
export function isLuhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  return luhnCheckDigit(digits.slice(0, -1)) === digits.charCodeAt(digits.length - 1) - 48;
}

/**
 * 16 digits, deterministic per account id, leading 0, never Luhn-valid.
 *
 * The digits come from the id read as one 128-bit number, not from picking
 * characters out of it: a v4 uuid has a fixed version character, and taking
 * characters one by one would put that constant into the last four digits.
 */
export function demoCardNumber(accountId: string): string {
  const hex = accountId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("demoCardNumber: not a uuid");

  const n = BigInt("0x" + hex);
  const space = BigInt("100000000000000"); // 10^14
  const body = "0" + (n % space).toString().padStart(14, "0"); // 15 digits

  // Offset 1..9 from the digit that would validate: never equal to it, so never valid.
  const offset = Number((n / space) % BigInt(9)) + 1;
  return body + String((luhnCheckDigit(body) + offset) % 10);
}
