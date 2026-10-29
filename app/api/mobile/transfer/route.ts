import { z } from "zod";
import { requireUser, admin } from "@/lib/mobile/auth";
import { checkTransferRateLimit, recordTransfer } from "@/lib/mobile/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  toAccountId: z.string().uuid(),
  amountMinor: z.number().int().positive().max(100_000_00),
  description: z.string().max(140).nullable().optional(),
  category: z.string().max(32).nullable().optional(),
});

// RPC error codes that map to 400
const BAD_REQUEST_CODES = new Set(["INSUFFICIENT_FUNDS", "INVALID_AMOUNT", "SAME_ACCOUNT", "CURRENCY_MISMATCH"]);
const REFUSAL_TEXT: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Insufficient funds.",
  INVALID_AMOUNT: "Invalid amount.",
  SAME_ACCOUNT: "You cannot transfer to your own account.",
  CURRENCY_MISMATCH: "The accounts use different currencies.",
};
// RPC error codes that map to 403 (identical message for both to avoid account enumeration)
const FORBIDDEN_CODES = new Set(["FORBIDDEN", "NO_SUCH_ACCOUNT"]);

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Authentication required." }, { status: 401 });
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return Response.json({ error: "invalid_request", message: "Idempotency-Key header is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "Invalid request body." }, { status: 400 });
  }

  const { toAccountId, amountMinor, description, category } = parsed.data;

  const rl = await checkTransferRateLimit(user.id);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", message: "Too many transfer attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // Look up the caller's main account — source is never taken from the request body
  const { data: fromAccount, error: accountError } = await admin
    .from("accounts")
    .select("id")
    .eq("owner_id", user.id)
    .eq("kind", "main")
    .single();

  if (accountError || !fromAccount) {
    return Response.json({ error: "invalid_request", message: "Source account not found." }, { status: 400 });
  }

  // This route calls post_transfer as service_role, which skips the database's
  // own rule that a signed-in person may not pay a system account (bank_fees,
  // bank_promo, bank_settlement). So the route has to enforce it itself:
  // refuse a destination that is a system account — and answer exactly as for
  // a destination that does not exist, so the response does not reveal which
  // ids are system accounts.
  const { data: destination } = await admin
    .from("accounts")
    .select("id, is_system")
    .eq("id", toAccountId)
    .maybeSingle();

  if (!destination || destination.is_system) {
    return Response.json({ error: "FORBIDDEN", message: "Transfer not permitted." }, { status: 403 });
  }

  // Call post_transfer with service-role client; idempotency key passed through.
  // Param names must match the live function's real signature — p_from/p_to/
  // p_amount_minor/p_rail, not p_from_account_id/p_to_account_id/p_amount,
  // confirmed against the live schema (the old names don't exist and every
  // call was failing with PGRST202 before this). category is NOT NULL on
  // transfers, so a client that omits it (the Zod schema allows this) falls
  // back to "other" rather than sending null and failing the insert.
  const { data: result, error: rpcError } = await admin.rpc("post_transfer", {
    p_from: fromAccount.id,
    p_to: toAccountId,
    p_amount_minor: amountMinor,
    p_description: description ?? null,
    p_category: category ?? "other",
    p_idempotency_key: idempotencyKey,
    p_rail: "internal",
  });

  if (rpcError) {
    // Postgres exception path
    const code = rpcError.code ?? "";
    const msg = rpcError.message ?? "Transfer failed.";
    if (BAD_REQUEST_CODES.has(code)) {
      return Response.json({ error: code, message: msg }, { status: 400 });
    }
    if (FORBIDDEN_CODES.has(code)) {
      return Response.json({ error: "FORBIDDEN", message: "Transfer not permitted." }, { status: 403 });
    }
    return Response.json({ error: "upstream_error", message: msg }, { status: 500 });
  }

  // Function return value path. post_transfer reports a refusal as
  // { ok: false, code } — the field is `code`; there is no `error` or `message`
  // in that payload, so the text below is ours.
  if (result && !result.ok) {
    const code: string = result.code ?? "";
    if (FORBIDDEN_CODES.has(code)) {
      return Response.json({ error: "FORBIDDEN", message: "Transfer not permitted." }, { status: 403 });
    }
    if (BAD_REQUEST_CODES.has(code)) {
      return Response.json({ error: code, message: REFUSAL_TEXT[code] ?? "Transfer failed." }, { status: 400 });
    }
    return Response.json({ error: code || "transfer_failed", message: "Transfer failed." }, { status: 400 });
  }

  // Record for rate limiting
  await recordTransfer(user.id);

  return Response.json({
    ok: true,
    transferId: result?.transfer_id ?? null,
    replayed: result?.replayed ?? false,
  });
}
