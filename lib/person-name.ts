// A person's name as the app shows it to someone else. Dependency-free so a test can run it directly.
//
// When a person deletes their account their profile row is deleted and their accounts are cut loose
// from them (owner_id null), but the transfers they made stay in other people's history. So the
// lookup finds no profile at all; and an emptied profile (names null) must not turn into the text
// "null null" either. In both cases the caller shows DELETED_PERSON.

export const DELETED_PERSON = "Deleted user";

/**
 * The short name the recipient list shows, "Anna A." — the same as the database function
 * recipient_label(first, last), measured on the live database on 18 November 2026: both parts
 * trimmed; no first name gives null; no surname gives the first name alone; otherwise the first
 * name, a space and the first character of the surname followed by a dot ("Anna Maria" + "van der
 * Berg" gives "Anna Maria v."; the case is kept).
 */
export function personLabel(first: string | null | undefined, last: string | null | undefined): string | null {
  const f = typeof first === "string" ? first.trim() : "";
  const l = typeof last === "string" ? last.trim() : "";
  if (!f) return null;
  if (!l) return f;
  return `${f} ${Array.from(l)[0]}.`;
}

/**
 * Is this note only the other side's name again? The mobile app fills an empty note with
 * "To <name>", a copy of what the row's heading already says. When the note is exactly that, for a
 * name this person is known by (the short one or the full one), it adds nothing and is hidden; any
 * other note is somebody's own words and is shown. Exact, not a guess: "To Anna A. for lunch" and
 * "Rent" stay.
 *
 * It cannot match for someone who has deleted their account (their name is gone from the lookup,
 * so `names` is empty); those copies are removed from the database by the deletion itself.
 */
export function isNameEcho(note: string | null | undefined, names: readonly string[]): boolean {
  const text = typeof note === "string" ? note.trim() : "";
  return text !== "" && names.some((n) => text === `To ${n}`);
}

export function personName(first: string | null | undefined, last: string | null | undefined): string | null {
  const name = [first, last]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ");
  return name || null;
}
