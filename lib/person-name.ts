// A person's name as the app shows it to someone else. Dependency-free so a test can run it directly.
//
// When a person deletes their account their profile row is deleted and their accounts are cut loose
// from them (owner_id null), but the transfers they made stay in other people's history. So the
// lookup finds no profile at all; and an emptied profile (names null) must not turn into the text
// "null null" either. In both cases the caller shows DELETED_PERSON.

export const DELETED_PERSON = "Deleted user";

export function personName(first: string | null | undefined, last: string | null | undefined): string | null {
  const name = [first, last]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ");
  return name || null;
}
