// Single sanitization point for transaction `description` text before it
// reaches an LLM prompt. This field is set by whoever sends/receives the
// payment - never the reader of the AI's response - so it is untrusted
// third-party input. Called from every place that puts transaction text in
// front of a model: app/api/ai/route.ts, app/api/neurooffice/route.ts, and
// lib/mobile/financial-context.ts. Do not duplicate this logic - import it.
//
// See recon.md / findings.md for the injection classes this defends against.
//
// Character sets below are built from numeric code points rather than
// written as \u escapes or literal characters in a regex, on purpose: this
// file's job is stripping invisible/control characters, so its own source
// must not risk carrying any.

const MAX_LENGTH = 280;

export const TXN_NOTE_OPEN = "<txn-note>";
export const TXN_NOTE_CLOSE = "</txn-note>";

// Unicode bidi/directional-override control characters: LRM, RLM, the
// embedding pair (LRE/RLE), PDF, the override pair (LRO/RLO), and the
// isolate family (LRI/RLI/FSI/PDI). These can visually reorder or hide text
// without changing the underlying bytes - never legitimate in a payment
// reference, always stripped outright.
const BIDI_CODEPOINTS = new Set([
  0x200e, 0x200f, // LRM, RLM
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, // LRE, RLE, PDF, LRO, RLO
  0x2066, 0x2067, 0x2068, 0x2069, // LRI, RLI, FSI, PDI
]);

function isBidiControl(codePoint: number): boolean {
  return BIDI_CODEPOINTS.has(codePoint);
}

// Other non-printable ASCII control characters. Tab (9), newline (10), and
// carriage return (13) are excluded - description text can be multi-line.
function isOtherControl(codePoint: number): boolean {
  if (codePoint === 9 || codePoint === 10 || codePoint === 13) return false;
  if (codePoint <= 0x1f) return true; // C0 control range
  if (codePoint === 0x7f) return true; // DEL
  return false;
}

// Fake role/turn markers ("System:", "Assistant:", ...). Defanging only the
// colon - not the word - keeps a legitimate note that happens to mention
// "system" or "admin" perfectly readable, while breaking the exact shape
// that reads as a chat-turn header.
const ROLE_MARKER_COLON = /\b(system|assistant|user|human|ai|root|admin)\s*:/gi;

function stripControlAndBidiChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (isBidiControl(cp) || isOtherControl(cp)) continue;
    out += ch;
  }
  return out;
}

/**
 * Cleans and fences a single transaction description for inclusion in a
 * prompt. Returns null for empty input so callers can keep their existing
 * `description ? " - " + description : ""` shape unchanged.
 */
export function sanitizeTransactionText(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let text = stripControlAndBidiChars(raw)
    // Angle brackets and curly braces are never meaningful in a real payment
    // reference - defang them so nothing in this field can read as an
    // XML/HTML-style tag (a fake "</transactions>" boundary, a fake
    // "<system>" block) or a JSON object shaped like a tool call.
    .replace(/</g, "[")
    .replace(/>/g, "]")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(ROLE_MARKER_COLON, (_match, word: string) => `${word}[:]`)
    .trim();

  if (!text) return null;

  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH).trimEnd() + "...";
  }

  return `${TXN_NOTE_OPEN}${text}${TXN_NOTE_CLOSE}`;
}
