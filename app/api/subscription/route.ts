import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PLAN_PRICE_PENCE } from "@/lib/plans";
import { ledgerPence } from "@/lib/money";
import type { Plan } from "@/types";
import { z } from "zod";

const VALID_PLANS = ["basic", "standard", "travel", "metal", "ultimate", "business"];

const schema = z.object({
  plan: z.string().refine((p) => VALID_PLANS.includes(p), { message: "Invalid plan" }),
  // Chosen by the browser when the confirm dialog opens, so a double click or a
  // retry is the same request to the ledger and the plan is charged once.
  requestId: z.string().uuid(),
});

// Charging a plan is the one money write the web makes as service_role: the
// database refuses a signed-in person paying a system account, and bank_fees is
// one. That also means post_transfer's own ownership check is skipped here, so
// this route is the guard and keeps to three rules:
//   - the paying account comes from the session, never from the request body;
//   - the destination is the bank_fees system account, looked up by kind;
//   - the idempotency key carries the user id (under service_role the database
//     only adds a shared "server:" prefix, which does not separate users).
// A dedicated database function for plan changes replaces this later.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const plan = parsed.data.plan as Plan;
  const { requestId } = parsed.data;
  const price = PLAN_PRICE_PENCE[plan];

  const { data: profile, error: profileFetchError } = await supabaseAdmin
    .from("profiles")
    .select("id, plan")
    .eq("id", user.id)
    .single();
  if (profileFetchError || !profile) {
    console.error("[subscription] Profile fetch error:", profileFetchError);
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (plan === profile.plan) {
    return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
  }

  const { data: mine } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("owner_id", user.id)
    .eq("kind", "main")
    .maybeSingle();
  if (!mine) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  let charged = false;
  let fees: string | null = null;

  if (price > 0) {
    const { data: feeAccount } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("kind", "bank_fees")
      .eq("is_system", true)
      .maybeSingle();
    if (!feeAccount) {
      console.error("[subscription] no bank_fees system account");
      return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
    }
    fees = feeAccount.id;

    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("post_transfer", {
      p_from: mine.id,
      p_to: fees,
      p_amount_minor: price,
      p_description: `Subscription - ${planLabel} plan`,
      p_category: "business",
      p_rail: "internal",
      p_idempotency_key: `subscription:${user.id}:${requestId}`,
    });

    if (rpcError) {
      console.error("[subscription] post_transfer error:", rpcError);
      return NextResponse.json({ error: "Failed to charge plan" }, { status: 500 });
    }
    if (!result?.ok) {
      if (result?.code === "INSUFFICIENT_FUNDS") return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
      console.error("[subscription] post_transfer refused:", result);
      return NextResponse.json({ error: "Failed to charge plan" }, { status: 500 });
    }
    charged = !result.replayed;
  }

  const { error: planError } = await supabaseAdmin
    .from("profiles")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (planError) {
    console.error("[subscription] plan update failed:", planError);
    // The charge posted but the plan did not change: give the money back with a
    // reversing transfer (the ledger is append-only — there is no delete).
    if (charged && fees) {
      const { error: undoError } = await supabaseAdmin.rpc("post_transfer", {
        p_from: fees,
        p_to: mine.id,
        p_amount_minor: price,
        p_description: "Subscription refund - plan change failed",
        p_category: "business",
        p_rail: "internal",
        p_idempotency_key: `subscription-refund:${user.id}:${requestId}`,
      });
      if (undoError) console.error("[subscription] REFUND FAILED, needs manual reversal:", { user: user.id, requestId, undoError });
    }
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }

  const { data: balance } = await supabaseAdmin
    .from("account_balances")
    .select("balance_minor")
    .eq("account_id", mine.id)
    .maybeSingle();

  return NextResponse.json({ success: true, balanceMinor: balance ? ledgerPence(balance.balance_minor) : null });
}
