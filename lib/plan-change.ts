// Changing a person's plan, for the web route and the app's route alike.
//
// The work is done by the database function change_plan(p_request_id, p_target), in one
// transaction: it looks the price up in the `plans` table (a price cannot be passed in), charges
// the new plan's price when it is higher than the current one (a downgrade, an equal price and a
// move to Basic are free, nothing is paid back), writes the fixed note from plans.charge_description,
// and sets the plan. A repeat of the same request (same p_request_id) charges nothing more.
// This module only calls it and says what came back, in words.
//
// The function takes the person from the session it is called with (it answers FORBIDDEN to a call
// with none, e.g. as service_role), so the routes call it with a client that carries the
// signed-in person's own token: nobody can be named in the request, and no service_role is involved.
//
// The success answer is exactly five keys: ok, replayed, plan, balance_minor, charged_minor (the balance is
// read from the ledger, not worked out from a charge). A key added later is ignored here, not refused.
//
// Erasable TypeScript only, so `node --test` can run lib/plan-change.test.mjs against this file.

import type { Plan } from "@/types";

/**
 * What change_plan answers when it refuses (the contract from migration 022: twelve codes).
 *
 * Its own six: FORBIDDEN, MISSING_REQUEST_ID, UNKNOWN_PLAN, NOT_PURCHASABLE, SAME_PLAN, NO_ACCOUNT.
 * Passed through from the posting function untranslated: INSUFFICIENT_FUNDS (the only one a person
 * will really meet), and INVALID_AMOUNT, SAME_ACCOUNT, NO_SUCH_ACCOUNT, CURRENCY_MISMATCH, which no
 * request can reach today but are not declared impossible: the posting function is shared with the
 * top-up and the welcome bonus. Names are the contract's, not ours: UNKNOWN_PLAN, SAME_PLAN and
 * NO_ACCOUNT, where this code first guessed INVALID_PLAN, ALREADY_ON_PLAN and NO_SUCH_ACCOUNT (which
 * is now a different code, from the posting function).
 *
 * The twelfth is CARD_FROZEN. The plan change first went past the door that checks a frozen card (a
 * defect, now fixed); the rule is now in the working function and says that money does not leave
 * an account whose owner has a frozen card. A top-up and the welcome bonus are exempt by
 * construction: they take from bank_promo, which has no owner and so no card.
 */
export type PlanRefusal =
  | "FORBIDDEN"
  | "MISSING_REQUEST_ID"
  | "UNKNOWN_PLAN"
  | "NOT_PURCHASABLE"
  | "SAME_PLAN"
  | "NO_ACCOUNT"
  | "INSUFFICIENT_FUNDS"
  | "INVALID_AMOUNT"
  | "SAME_ACCOUNT"
  | "NO_SUCH_ACCOUNT"
  | "CURRENCY_MISMATCH"
  | "CARD_FROZEN";

export type PlanChange =
  | { ok: true; replayed: boolean; plan: Plan; balanceMinor: number; chargedMinor: number }
  | { ok: false; code: PlanRefusal }
  /** the function failed or answered something this code does not know: nothing is known to have changed */
  | { ok: false; code: "FAILED" };

const NOT_THE_PERSONS_FAULT = "Could not change your plan. Please try again.";

/** Each refusal: the HTTP status, and the words, for the app and for the web (whose settings page matches one of them). */
export const PLAN_REFUSALS: Record<PlanRefusal, { status: number; message: string; webMessage: string }> = {
  FORBIDDEN: { status: 403, message: "Not permitted.", webMessage: "Not permitted" },
  MISSING_REQUEST_ID: { status: 400, message: "Invalid request.", webMessage: "Invalid request" },
  UNKNOWN_PLAN: { status: 400, message: "That plan does not exist.", webMessage: "Invalid plan" },
  NOT_PURCHASABLE: { status: 400, message: "That plan cannot be bought here.", webMessage: "That plan cannot be bought here" },
  SAME_PLAN: { status: 409, message: "You are already on this plan.", webMessage: "Already on this plan" },
  NO_ACCOUNT: { status: 400, message: "Account not found.", webMessage: "Account not found" },
  // the web settings page tells this one apart by its exact text
  INSUFFICIENT_FUNDS: { status: 400, message: "Insufficient funds.", webMessage: "Insufficient balance" },
  CARD_FROZEN: { status: 400, message: "Your card is frozen. Unfreeze it to change your plan.", webMessage: "Your card is frozen. Unfreeze it to change your plan." },
  // unreachable today, not declared impossible; if one comes it is a fault, not something to tell the person to fix
  INVALID_AMOUNT: { status: 500, message: NOT_THE_PERSONS_FAULT, webMessage: "Failed to update plan" },
  SAME_ACCOUNT: { status: 500, message: NOT_THE_PERSONS_FAULT, webMessage: "Failed to update plan" },
  NO_SUCH_ACCOUNT: { status: 500, message: NOT_THE_PERSONS_FAULT, webMessage: "Failed to update plan" },
  CURRENCY_MISMATCH: { status: 500, message: NOT_THE_PERSONS_FAULT, webMessage: "Failed to update plan" },
};

const toPence = (value: unknown): number => {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};

/** `db` is the signed-in person's own client: the function reads who is asking from its session. */
export async function changePlan(
  db: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> },
  input: { plan: string; requestId: string },
): Promise<PlanChange> {
  const { data, error } = await db.rpc("change_plan", {
    p_request_id: input.requestId,
    p_target: input.plan,
  });
  if (error || !data || typeof data !== "object") {
    console.error("[plan-change] change_plan failed:", error ?? data);
    return { ok: false, code: "FAILED" };
  }
  if (data.ok === true) {
    const balanceMinor = toPence(data.balance_minor);
    const chargedMinor = toPence(data.charged_minor);
    if (typeof data.plan !== "string" || Number.isNaN(balanceMinor) || Number.isNaN(chargedMinor)) {
      console.error("[plan-change] change_plan answered an unexpected shape:", data);
      return { ok: false, code: "FAILED" };
    }
    return { ok: true, replayed: data.replayed === true, plan: data.plan as Plan, balanceMinor, chargedMinor };
  }
  if (typeof data.code === "string" && data.code in PLAN_REFUSALS) return { ok: false, code: data.code as PlanRefusal };
  console.error("[plan-change] change_plan refused with a code this code does not know:", data);
  return { ok: false, code: "FAILED" };
}
