// Which transfers the history shows as "Subscription" instead of naming the
// other side. Pure and dependency-free so lib/ledger-label.test.mjs can run it
// under node directly.
//
// A payment *to a system account* counts as a subscription when any of these hold:
//   1. it went to bank_fees — the account plan charges are posted to;
//   2. its category is "subscription", or its description starts with
//      "Subscription" — how a charge reads once migration 015 has restored the
//      original text on the imported history;
//   3. it is imported web history (rail "web") that went to bank_settlement.
//      Before 015 those rows carry no text to match, so this is the only marker
//      they have. It holds for the data as it is: the old web app had exactly
//      one payment with no recipient — the plan charge — and all 10 of them sit
//      on bank_settlement.
// Anything else sent to a system account is not named a subscription.

export interface SubscriptionProbe {
  sent: boolean;
  /** accounts.kind of the other side ("main", "bank_fees", "bank_settlement", …) */
  destKind: string | undefined;
  rail: string;
  category: string;
  description: string | null;
}

export function isSubscription(p: SubscriptionProbe): boolean {
  if (!p.sent || !p.destKind || p.destKind === "main") return false; // only payments to system accounts
  if (p.destKind === "bank_fees") return true;
  if (p.category === "subscription") return true;
  if (/^Subscription\b/i.test(p.description ?? "")) return true;
  return p.rail === "web" && p.destKind === "bank_settlement";
}
