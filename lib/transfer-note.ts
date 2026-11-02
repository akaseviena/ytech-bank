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
// Erasable TypeScript only, so `node --test` can run lib/transfer-note.test.mjs
// against this file directly.

// The texts /api/subscription writes (plan names as in lib/plans.ts, basic is free).
const APP_WRITTEN_NOTES: ReadonlySet<string> = new Set([
  "Subscription - Standard plan",
  "Subscription - Travel plan",
  "Subscription - Metal plan",
  "Subscription - Ultimate plan",
  "Subscription - Business plan",
  "Subscription refund - plan change failed",
]);

/** The note, if this app wrote it; null for anything a person typed or a client filled in. */
export function appWrittenNote(description: string | null | undefined): string | null {
  const text = (description ?? "").trim();
  return APP_WRITTEN_NOTES.has(text) ? text : null;
}
