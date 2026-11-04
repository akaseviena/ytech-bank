import { z } from "zod";
import { requireUser, clientFor } from "@/lib/mobile/auth";
import { checkTransferRateLimit, recordTransfer } from "@/lib/mobile/rate-limit";
import { changePlan, PLAN_REFUSALS } from "@/lib/plan-change";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Switch the signed-in person to another plan.
//
//   POST /api/mobile/subscription   { "plan": "standard", "requestId": "<uuid>" }
//
// `requestId` is chosen by the app when the confirmation opens and kept for as long as it is
// open: a double tap or a retry of the same request charges nothing more. A new confirmation is
// a new request, so Standard -> Travel -> Standard pays for Standard twice (each is a purchase).
//
// What it costs is decided by the database (change_plan): the new plan's price if it is higher
// than the current one; a downgrade, an equal price and a move to Basic are free; nothing is
// paid back. The answer says what was charged (`chargedMinor`); show that, do not work it out.
//
//   200 { ok: true, plan, balanceMinor, chargedMinor, replayed }
//   400/409 { error: CODE, message }   INVALID_PLAN, NOT_PURCHASABLE (Business), NO_SUCH_ACCOUNT,
//                                      INSUFFICIENT_FUNDS, CARD_FROZEN (400); ALREADY_ON_PLAN (409)
const schema = z.object({
  plan: z.string().min(1).max(32),
  requestId: z.string().uuid(),
});

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Authentication required." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "Invalid request body." }, { status: 400 });
  }

  // a money action, held to the same limit as a transfer
  const rl = await checkTransferRateLimit(user.id);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", message: "Too many attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // Called with the person's own token, so the database function knows who is asking; nobody can be
  // named in the body.
  const result = await changePlan(clientFor(request), { plan: parsed.data.plan, requestId: parsed.data.requestId });

  if (!result.ok) {
    if (result.code === "FAILED") {
      return Response.json({ error: "upstream_error", message: "Could not change your plan. Please try again." }, { status: 500 });
    }
    const refusal = PLAN_REFUSALS[result.code];
    return Response.json({ error: result.code, message: refusal.message }, { status: refusal.status });
  }

  await recordTransfer(user.id);
  return Response.json({
    ok: true,
    plan: result.plan,
    balanceMinor: result.balanceMinor,
    chargedMinor: result.chargedMinor,
    replayed: result.replayed,
  });
}
