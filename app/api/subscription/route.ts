import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const PLAN_PRICE: Record<string, number> = {
  basic:    0,
  standard: 4.90,
  travel:   9.90,
  metal:    14.90,
  ultimate: 34.90,
  business: 30.00,
};

const VALID_PLANS = ["basic", "standard", "travel", "metal", "ultimate", "business"];

const schema = z.object({
  plan: z.string().refine((p) => VALID_PLANS.includes(p), { message: "Invalid plan" }),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const { plan } = parsed.data;
  const price = PLAN_PRICE[plan];

  console.log("[subscription] User:", user.id, "→ plan:", plan, "price:", price);

  // Fetch current profile
  const { data: profile, error: profileFetchError } = await supabaseAdmin
    .from("profiles")
    .select("id, balance, plan")
    .eq("id", user.id)
    .single();

  if (profileFetchError || !profile) {
    console.error("[subscription] Profile fetch error:", profileFetchError);
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (plan === profile.plan) {
    return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
  }

  if (price > 0 && Number(profile.balance) < price) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  const newBalance = price > 0 ? Number(profile.balance) - price : Number(profile.balance);

  // Update profile (plan + balance) using admin client to bypass RLS
  const profileUpdate: Record<string, unknown> = {
    plan,
    updated_at: new Date().toISOString(),
  };
  if (price > 0) profileUpdate.balance = newBalance;

  const { error: profileUpdateError } = await supabaseAdmin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (profileUpdateError) {
    console.error("[subscription] Profile update error:", profileUpdateError);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }

  // Insert withdrawal transaction using admin client (bypasses RLS entirely)
  if (price > 0) {
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    console.log("[subscription] Inserting transaction:", { userId: user.id, price, plan });

    const { data: txData, error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        sender_id: user.id,
        receiver_id: null,
        amount: price,
        type: "withdrawal",
        category: "business",
        description: `Subscription - ${planLabel} plan`,
        status: "completed",
      })
      .select()
      .single();

    console.log("[subscription] Transaction insert result:", { data: txData, error: txError });

    if (txError) {
      console.error("[subscription] Transaction insert FAILED:", txError);
      // Plan was already updated — log but don't fail the response
    }
  }

  return NextResponse.json({ success: true, newBalance });
}
