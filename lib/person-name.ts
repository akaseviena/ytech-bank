// A person's name as the app shows it to someone else. Dependency-free so a test can run it directly.
//
// When a person deletes their account their profile is emptied (or removed), but the transfers they
// made stay in other people's history. A name that is null on both sides must not turn into the
// text "null null" on someone else's screen, so a missing name is a missing name, and the caller
// shows DELETED_PERSON instead.

export const DELETED_PERSON = "Deleted user";

export function personName(first: string | null | undefined, last: string | null | undefined): string | null {
  const name = [first, last]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ");
  return name || null;
}
