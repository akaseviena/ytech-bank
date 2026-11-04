import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { changePlan, PLAN_REFUSALS } from "@/lib/plan-change";
import { z } from "zod";

const schema = z.object({
  plan: z.string().min(1).max(32),
  // Chosen by the browser when the confirm dialog opens, so a double click or a retry is the
  // same request to the database and the plan is charged once.
  requestId: z.string().uuid(),
});

// The web's plan change. Everything that matters happens in the database function change_plan
// (lib/plan-change.ts): the price comes from the `plans` table, the charge and the plan change
// are one transaction, a repeat of the same request charges nothing more. This route is the guard
// in front of it: it calls it with the signed-in person's own client, so who is asking comes from
// the session and from nowhere else.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const result = await changePlan(supabase, { plan: parsed.data.plan, requestId: parsed.data.requestId });

  if (!result.ok) {
    if (result.code === "FAILED") return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
    const refusal = PLAN_REFUSALS[result.code];
    return NextResponse.json({ error: refusal.webMessage, code: result.code }, { status: refusal.status });
  }

  return NextResponse.json({
    success: true,
    plan: result.plan,
    balanceMinor: result.balanceMinor,
    // what was actually charged: a downgrade, an equal price and a move to Basic are free
    chargedMinor: result.chargedMinor,
    replayed: result.replayed,
  });
}
