import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

// What the person who is LEFT sees when someone they paid has deleted their account: the transfer
// stays in their history, and the name next to it comes from a profile that may now be empty or gone.

register("./test-support/alias-hooks.mjs", import.meta.url);
const { personName, DELETED_PERSON } = await import("./person-name.ts");
const { resolveCounterparties, toItems } = await import("./ledger.ts");

const ME = "aaaaaaaa-0000-4000-8000-000000000001";
const GONE = "aaaaaaaa-0000-4000-8000-000000000002";
const GONE_NO_PROFILE = "aaaaaaaa-0000-4000-8000-000000000003";
const ALIVE = "aaaaaaaa-0000-4000-8000-000000000004";
const row = (id, from, to) => ({ id, from_account: from, to_account: to, amount_minor: "500", description: null, category: "other", rail: "internal", status: "completed", created_at: "2026-11-01T10:00:00Z" });

test("a missing name is a missing name, never the text 'null null'", () => {
  assert.equal(personName("Anna", "Archer"), "Anna Archer");
  assert.equal(personName("Anna", null), "Anna");
  assert.equal(personName(null, "Archer"), "Archer");
  assert.equal(personName(null, null), null);
  assert.equal(personName("", "  "), null);
  assert.equal(personName(undefined, undefined), null);
});

test("history names someone who deleted their account 'Deleted user', with no picture, however the deletion left the data", async () => {
  const db = fakeDb({
    accounts: [
      { id: ME, kind: "main", owner_id: "u-me" },
      { id: GONE, kind: "main", owner_id: "u-gone" },          // profile kept, emptied
      { id: GONE_NO_PROFILE, kind: "main", owner_id: null },   // owner removed
      { id: ALIVE, kind: "main", owner_id: "u-alive" },
    ],
    profiles: [
      { id: "u-gone", first_name: null, last_name: null, avatar_url: "https://example.test/old-face.png" },
      { id: "u-alive", first_name: "Anna", last_name: "Archer", avatar_url: null },
    ],
  });
  const rows = [row("t1", ME, GONE), row("t2", GONE, ME), row("t3", ME, GONE_NO_PROFILE), row("t4", ME, ALIVE)];
  const names = await resolveCounterparties(db, rows, ME);
  const items = toItems(rows, ME, names);
  assert.deepEqual(items.map((i) => i.counterparty.name), [DELETED_PERSON, DELETED_PERSON, DELETED_PERSON, "Anna Archer"]);
  assert.equal(items[0].counterparty.avatarUrl, null, "a leftover picture is not shown");
  assert.ok(items.every((i) => !/null|undefined/.test(i.counterparty.name)));
  assert.equal(items[0].amountMinor, 500, "the money part of the row is untouched");
});
