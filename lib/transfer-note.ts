// Which transfer notes may be shown to a model.
//
// The note on a transfer (transfers.description, up to 140 characters) is free
// text typed by whoever made the payment — or filled in by the sender's app, which
// in practice puts the recipient's name there ("To Anna K."). Either way it can
// name a person who signed nothing and is not mentioned in the consent screen: the
// recipient on a payment you sent, you yourself on a payment you received, anyone
// the sender chose to write about. It cannot be cleaned reliably, so the model gets
// the notes this app writes itself and no others.
//
// Who writes transfers.description (checked in code on 2 November 2026):
//   web transfer page    the text typed in the Note box, sent as typed, or null. Nothing is
//                        prefilled, and it was the same before the ledger: transfer_funds
//                        stored p_description unchanged.
//   iOS app              (as read from its code by the mobile side — not in this repo) exactly
//                        "To " + the recipient's name as "First I.", on a payment the person
//                        sends, always with the prefix. Nothing on a payment received. It never
//                        writes "From <name>" and never a bare name.
//   POST /api/mobile/transfer   passes the client's text through unchanged (up to 140 characters).
//   change_plan (the database function behind POST /api/subscription and /api/mobile/subscription)
//                        writes plans.charge_description: today the four Subscription texts of the plans
//                        that are sold. Business's text and the refund text are no longer written, and stay
//                        in the list below because old rows carry them.
//   SQL (outside this repo)   claim_demo_topup (migration 023) writes "Demo top-up";
//                        grant_welcome_bonus (migration 001) writes "Welcome demo balance", on the promo
//                        rail, which, like the migration rail, is left out of every context; balance
//                        adjustments are written the same way.
// So a note is the person's own words, or "To <name>" put in by the app, or one of our fixed
// texts. A filter that catches "To <name>" alone would miss the typed notes, and one that
// reads typed notes cannot tell a name from a word: sanitizeTransactionText strips control and
// bidirectional characters, swaps < > { } for [ ] ( ), defangs "system:"-style role markers, caps
// the length at 280 and fences the text — it does nothing about names.
//
// Erasable TypeScript only, so `node --test` can run lib/transfer-note.test.mjs
// against this file directly.

// The texts the app itself writes on a transfer: the plan charges (plan names as in lib/plans.ts,
// basic is free) and the two demo-money notes the database writes. Each is exact: one character off
// and a typed note would pass for ours. The two demo-money strings were supplied by the side that
// writes them and are not to be renamed (they are already on existing rows). The plan charge texts
// must be what the plans table holds in charge_description (`npm run check:plans` compares them).
const APP_WRITTEN_NOTES: ReadonlySet<string> = new Set([
  "Subscription - Standard plan",
  "Subscription - Travel plan",
  "Subscription - Metal plan",
  "Subscription - Ultimate plan",
  "Subscription - Business plan",
  "Subscription refund - plan change failed",
  "Demo top-up",
  "Welcome demo balance",
]);

/** The note, if this app wrote it; null for anything a person typed or a client filled in. */
export function appWrittenNote(description: string | null | undefined): string | null {
  const text = (description ?? "").trim();
  return APP_WRITTEN_NOTES.has(text) ? text : null;
}
