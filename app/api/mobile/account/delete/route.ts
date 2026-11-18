import { z } from "zod";
import { requireUser, clientFor, admin } from "@/lib/mobile/auth";
import { deleteAccount } from "@/lib/account-deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Delete the signed-in person's account.
//
//   POST /api/mobile/account/delete   { "confirm": true }
//
// Not undoable. `confirm` has to be the literal `true`, sent after the person has confirmed on
// screen, so that nothing else (a stray request, a retry loop) can reach this by accident.
//
// What it does, in this order (lib/account-deletion.ts): the database function runs with the
// person's own token, then their picture is removed, and only then their sign-in. If anything
// fails the answer is an error and the sign-in is still there, so the app can show it and the
// same request can be sent again; a repeat is safe.
//
//   200 { ok: true }
//   400 { error: "invalid_request" }     no `confirm: true`
//   401 { error: "unauthorized" }
//   403 { error: "forbidden" }
//   409 { error: CODE, message }         the database refused (CODE is its code, e.g. a reason the
//                                        account cannot be closed yet); show `message`
// Two states, not three, because the status says what the person should do, not which step stopped:
//   503 { error: "cleanup_failed" | "auth_delete_failed", message }   the data is already gone, the
//                                        sign-in still works, the server has not finished: the person
//                                        sends the same request again (the app has its own words)
//   500 { error: "upstream_error", message }   the database function did not answer, so nothing has
//                                        happened: try again from the start
const schema = z.object({ confirm: z.literal(true) });

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Authentication required." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "Confirmation is required." }, { status: 400 });
  }

  const result = await deleteAccount(clientFor(request), admin, user.id);
  if (!result.ok) {
    return Response.json({ error: result.code, message: result.message }, { status: result.status });
  }
  return Response.json({ ok: true });
}
