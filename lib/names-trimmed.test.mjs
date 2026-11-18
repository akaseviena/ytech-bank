import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

// A person's name is what is left after trimming, and it cannot be empty. The recipient list
// (recipient_label) answers null for an empty first name and leaves that person out, so a name of
// only spaces would make someone impossible to find as a recipient, silently.

register("./test-support/alias-hooks.mjs", import.meta.url);
register("./test-support/route-hooks.mjs", import.meta.url);

const registerRoute = await import("../app/api/auth/register/route.ts");
const profileRoute = await import("../app/api/profile/route.ts");

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const valid = { email: "a@example.test", password: "password123", firstName: "Anna", lastName: "Archer", dateOfBirth: "1990-01-01", plan: "basic" };

function setup() {
  const created = [];
  const db = fakeDb({ profiles: [{ id: USER.id, first_name: "Old", last_name: "Name" }] });
  db.auth = {
    getUser: async () => ({ data: { user: USER } }),
    admin: {
      createUser: async (args) => { created.push(args); return { data: { user: { id: USER.id } }, error: null }; },
      deleteUser: async () => ({ error: null }),
    },
  };
  globalThis.__routeTest = { db, user: USER };
  return { db, created };
}
const register_ = async (body) => {
  const res = await registerRoute.POST(new Request("http://localhost/api/auth/register", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

test("registration: names are trimmed before they are stored", async () => {
  const w = setup();
  const r = await register_({ ...valid, firstName: "  Anna ", lastName: "\tArcher  " });
  assert.equal(r.status, 200);
  assert.deepEqual(w.created[0].user_metadata, { first_name: "Anna", last_name: "Archer", plan: "basic" }, "the sign-in's own copy");
  const stored = w.db.writes.find((x) => x.table === "profiles");
  assert.equal(stored.values.first_name, "Anna");
  assert.equal(stored.values.last_name, "Archer");
});

test("registration: a name of only spaces is refused, and nothing is created", async () => {
  for (const over of [{ firstName: "   " }, { lastName: " \t " }, { firstName: "" }, { firstName: "  " }]) {
    const w = setup();
    const r = await register_({ ...valid, ...over });
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.equal(w.created.length, 0, "no sign-in was made");
    assert.equal(w.db.writes.length, 0);
  }
});

test("profile edit: the same rule", async () => {
  let w = setup();
  let res = await profileRoute.PATCH(new Request("http://localhost/api/profile", { method: "PATCH", body: JSON.stringify({ first_name: " Anna ", last_name: " Archer " }) }));
  assert.equal(res.status, 200);
  const update = w.db.writes.find((x) => x.table === "profiles" && x.kind === "update");
  assert.equal(update.values.first_name, "Anna");
  assert.equal(update.values.last_name, "Archer");

  for (const body of [{ first_name: "   ", last_name: "Archer" }, { first_name: "Anna", last_name: "  " }]) {
    w = setup();
    res = await profileRoute.PATCH(new Request("http://localhost/api/profile", { method: "PATCH", body: JSON.stringify(body) }));
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(w.db.writes.length, 0);
  }
});
