// The pre-release check for plans: the hand-written copies of the plan table (lib/plans.ts here,
// a copy in the app) are compared with what the server publishes from the `plans` table, and
// any difference is reported. The server is the first copy; a copy that disagrees is the one to fix.
//
//   npm run check:plans            (CHECK_BASE_URL=https://... node scripts/check-plans.mjs)
//
// Also checked: every charge description the server publishes is one of the notes the AI-context
// filter recognises as the app's own (lib/transfer-note.ts). A description that differs by one
// character would be treated as something a person typed, so it is caught here, not in production.
//
// Erasable TypeScript only, so `node --test` can run lib/plan-change.test.mjs against this file.

import { appWrittenNote } from "@/lib/transfer-note";

/** One row of GET /api/mobile/plans. */
export interface PublishedPlan {
  id: string;
  label: string;
  priceMinor: number;
  /** the price is a "from" price (Business) */
  priceFrom: boolean;
  /** change_plan will switch to it; Business is not sold by a button */
  purchasable: boolean;
  /** the note written on the charge; null for a plan that is free or not sold */
  chargeDescription: string | null;
}

export interface LocalPlans {
  prices: Record<string, number>;
  purchasable: Record<string, boolean>;
}

/** The differences, as sentences; empty when the copy agrees with the server. */
export function comparePlans(published: PublishedPlan[], local: LocalPlans): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const p of published) {
    seen.add(p.id);
    if (!(p.id in local.prices)) problems.push(`the server has the plan "${p.id}", this copy does not`);
    else if (local.prices[p.id] !== p.priceMinor) problems.push(`"${p.id}" costs ${p.priceMinor} on the server and ${local.prices[p.id]} here`);
    if (p.id in local.purchasable && local.purchasable[p.id] !== p.purchasable) {
      problems.push(`"${p.id}" is ${p.purchasable ? "" : "not "}purchasable on the server and ${local.purchasable[p.id] ? "" : "not "}purchasable here`);
    }
    // a plan that costs money and can be bought needs a note on its charge; any other must not have one
    if ((p.purchasable && p.priceMinor > 0) !== (p.chargeDescription !== null)) {
      problems.push(`the server's row for "${p.id}" has ${p.chargeDescription === null ? "no" : "a"} charge note, which does not fit a plan that is ${p.purchasable ? "" : "not "}purchasable at ${p.priceMinor}`);
    }
    if (p.chargeDescription !== null && appWrittenNote(p.chargeDescription) !== p.chargeDescription) {
      problems.push(`the charge note of "${p.id}" (${JSON.stringify(p.chargeDescription)}) is not one the AI-context filter recognises`);
    }
  }
  for (const id of Object.keys(local.prices)) if (!seen.has(id)) problems.push(`this copy has the plan "${id}", the server does not`);
  return problems;
}
