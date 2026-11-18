import type { SupabaseClient } from "@supabase/supabase-js";

// Deleting an account, the server's part. The database part is a function written on the app's
// side; this file only decides the ORDER and what to do with each answer.
//
//   1. the database function, called with the person's own session (so auth.uid() inside it is the
//      person who asked, and nobody can be named in the call). It cuts the accounts loose from the
//      person, deletes the profile (the rest follows by cascade) and records the request in
//      account_deletions.
//   2. only if it succeeded: the person's picture in storage, which SQL cannot remove.
//   3. only after both: the sign-in itself, with the service-role key.
//   4. the request is marked done: auth_deleted_at set and user_id cleared, so the table no longer
//      holds the id of someone who is gone. With the service role: there is no session by now.
//
// The order is the point. If the database fails after the sign-in is gone, what is left is data
// nobody owns and nobody can log in to change. The other way round, a failure leaves a person who
// can still sign in and ask again, so every step must be safe to repeat: the function answers
// ALREADY_DELETED (or ok) the second time, listing and removing a picture twice is harmless, and
// an already-removed sign-in counts as done. A failed sign-in removal is retried by the person's
// next request; there is no background sweep. What is unfinished is visible with
//   select * from account_deletions where auth_deleted_at is null;

/** The database function. Takes no arguments: the session says who. */
export const DELETE_ACCOUNT_RPC = "delete_my_account";
/** Where profile pictures live (app/(dashboard)/profile/page.tsx uploads to `avatars/<user id>.<ext>`). */
export const AVATAR_BUCKET = "avatars";
export const AVATAR_FOLDER = "avatars";

export type DeletionResult =
  | { ok: true; alreadyErased: boolean }
  | { ok: false; status: number; code: string; message: string };

const failure = (status: number, code: string, message: string): DeletionResult => ({ ok: false, status, code, message });

const TRY_AGAIN = "Your account could not be deleted. Please try again.";
const A_CODE = /^[A-Z][A-Z0-9_]{2,39}$/;

export async function deleteAccount(session: SupabaseClient, admin: SupabaseClient, userId: string): Promise<DeletionResult> {
  // 1. the database
  let alreadyErased = false;
  try {
    const { data, error } = await session.rpc(DELETE_ACCOUNT_RPC);
    const answer = data as { ok?: unknown; code?: unknown } | null;
    if (error || !answer || typeof answer !== "object") {
      console.error("[account-deletion] the function failed:", error?.message ?? "no answer");
      return failure(500, "upstream_error", TRY_AGAIN);
    }
    if (answer.ok === false) {
      const code = typeof answer.code === "string" ? answer.code : "";
      if (code === "ALREADY_DELETED") alreadyErased = true; // a repeat after a later step failed: go on
      else if (code === "FORBIDDEN") return failure(403, "forbidden", "You cannot delete this account.");
      else if (A_CODE.test(code)) return failure(409, code, "Your account cannot be deleted right now.");
      else return failure(500, "upstream_error", TRY_AGAIN);
    } else if (answer.ok !== true) {
      return failure(500, "upstream_error", TRY_AGAIN);
    } else if ((answer as { code?: unknown }).code === "ALREADY_DELETED") {
      // what the function really answers on a repeat (profile gone, sign-in still there):
      // { ok: true, code: "ALREADY_DELETED", closed_minor: 0 }
      alreadyErased = true;
    }
  } catch (err) {
    console.error("[account-deletion] the function threw:", err);
    return failure(500, "upstream_error", TRY_AGAIN);
  }

  // 2. the picture. A public file named after the person's id; the extension is whatever they uploaded.
  try {
    const bucket = admin.storage.from(AVATAR_BUCKET);
    const listed = await bucket.list(AVATAR_FOLDER, { search: userId });
    if (listed.error) throw new Error(listed.error.message);
    const mine = (listed.data ?? []).filter((f) => f.name.startsWith(userId)).map((f) => `${AVATAR_FOLDER}/${f.name}`);
    if (mine.length > 0) {
      const removed = await bucket.remove(mine);
      if (removed.error) throw new Error(removed.error.message);
    }
  } catch (err) {
    // stop before the sign-in goes: after it there would be nobody left to retry this
    console.error("[account-deletion] removing the picture failed:", err);
    return failure(503, "cleanup_failed", TRY_AGAIN);
  }

  // 3. the sign-in
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404 && !/not.?found/i.test(error.message)) {
      console.error("[account-deletion] removing the sign-in failed:", error.message);
      return failure(503, "auth_delete_failed", TRY_AGAIN);
    }
  } catch (err) {
    console.error("[account-deletion] removing the sign-in threw:", err);
    return failure(503, "auth_delete_failed", TRY_AGAIN);
  }

  // 4. Mark it done. The person is already gone, so a failure here must not be reported as a
  //    failed deletion (nobody could repeat it); it is logged, and the row stays visible in the
  //    unfinished list for whoever looks.
  try {
    const { error } = await admin
      .from("account_deletions")
      .update({ auth_deleted_at: new Date().toISOString(), user_id: null })
      .eq("user_id", userId)
      .is("auth_deleted_at", null);
    if (error) console.error("[account-deletion] marking the request done failed:", error.message);
  } catch (err) {
    console.error("[account-deletion] marking the request done threw:", err);
  }

  return { ok: true, alreadyErased };
}
