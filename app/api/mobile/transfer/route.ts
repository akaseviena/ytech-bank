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
    .eq("type", "main")
    .single();

  if (accountError || !fromAccount) {
    return Response.json({ error: "invalid_request", message: "Source account not found." }, { status: 400 });
  }

  // Call post_transfer with service-role client; idempotency key passed through
  const { data: result, error: rpcError } = await admin.rpc("post_transfer", {
    p_from_account_id: fromAccount.id,
    p_to_account_id: toAccountId,
    p_amount: amountMinor,
    p_description: description ?? null,
    p_category: category ?? null,
    p_idempotency_key: idempotencyKey,
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

  // Function return value path — check for application-level error in result
  if (result && !result.ok) {
    const code: string = result.error ?? "";
    const msg: string = result.message ?? "Transfer failed.";
    if (BAD_REQUEST_CODES.has(code)) {
      return Response.json({ error: code, message: msg }, { status: 400 });
    }
    if (FORBIDDEN_CODES.has(code)) {
      return Response.json({ error: "FORBIDDEN", message: "Transfer not permitted." }, { status: 403 });
    }
    return Response.json({ error: code, message: msg }, { status: 400 });
  }

  // Record for rate limiting
  await recordTransfer(user.id);

  return Response.json({
    ok: true,
    transferId: result?.transfer_id ?? null,
    replayed: result?.replayed ?? false,
  });
}
