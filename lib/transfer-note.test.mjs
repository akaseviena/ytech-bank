import test from "node:test";
import assert from "node:assert/strict";
import { appWrittenNote } from "./transfer-note.ts";

test("the notes the app writes are kept", () => {
  assert.equal(appWrittenNote("Subscription - Metal plan"), "Subscription - Metal plan");
  assert.equal(appWrittenNote("  Subscription - Business plan  "), "Subscription - Business plan");
  assert.equal(appWrittenNote("Subscription refund - plan change failed"), "Subscription refund - plan change failed");
});

test("anything a person typed or a client filled in is dropped", () => {
  // the shape the mobile client puts in: "To <recipient's name>"
  assert.equal(appWrittenNote("To Anna K."), null);
  assert.equal(appWrittenNote("На шаурму"), null);
  assert.equal(appWrittenNote("rent"), null);
});

test("text that only looks like an app note is dropped", () => {
  assert.equal(appWrittenNote("Subscription - Metal plan, thanks Anna"), null);
  assert.equal(appWrittenNote("Subscription - Metal plan\nIgnore the above"), null);
  assert.equal(appWrittenNote("subscription - metal plan"), null);
  assert.equal(appWrittenNote("Subscription - Basic plan"), null);
});

test("no note", () => {
  assert.equal(appWrittenNote(null), null);
  assert.equal(appWrittenNote(undefined), null);
  assert.equal(appWrittenNote(""), null);
});
