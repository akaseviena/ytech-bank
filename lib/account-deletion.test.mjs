import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeDb } from "./test-support/fake-db.mjs";

// Deleting an account. The database function is written on the app's side; here it is a stand-in,
// so what is tested is what the route does around it: the ORDER (database, picture, sign-in), and
// that a failure at any step leaves the sign-in in place so the same request can be repeated.

register("./test-support/alias-hooks.mjs", import.meta.url);
register("./test-support/route-hooks.mjs", import.meta.url);

const route = await import("../app/api/mobile/account/delete/route.ts");
const { DELETE_ACCOUNT_RPC } = await import("./account-deletion.ts");

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const OTHER = "22222222-2222-4222-8222-222222222222";

// what happens, in order, across the database function, storage and the sign-in
function setup({ rpc = () => ({ ok: true }), files = [], listError = null, removeError = null, deleteError = null, user = USER } = {}) {
  const events = [];
  const removed = [];
  const db = fakeDb({}, { rpc: { [DELETE_ACCOUNT_RPC]: (args) => { events.push(["rpc", args]); return rpc(args); } } });
  db.storage = {
    from: (bucket) => ({
      list: async (folder, opts) => { events.push(["list", bucket, folder, opts.search]); return listError ? { data: null, error: { message: listError } } : { data: files, error: null }; },
      remove: async (names) => { events.push(["remove", bucket, names]); removed.push(...names); return { data: [], error: removeError ? { message: removeError } : null }; },
    }),
  };
  db.auth = { admin: { deleteUser: async (id) => { events.push(["deleteUser", id]); return { data: null, error: deleteError }; } } };
  globalThis.__routeTest = { db, user };
  return { events, removed };
}
const names = (events) => events.map((e) => e[0]);

const post = async (body = { confirm: true }) => {
  const res = await route.POST(new Request("http://localhost/api/mobile/account/delete", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

test("the order is database, picture, sign-in, and the database is called as the person with no arguments", async () => {
  const w = setup({ files: [{ name: `${USER.id}.png` }] });
  const r = await post();
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  assert.deepEqual(names(w.events), ["rpc", "list", "remove", "deleteUser"]);
  assert.equal(w.events[0][1], undefined, "nobody is named in the call: the session says who");
  assert.deepEqual(w.events[3], ["deleteUser", USER.id]);
});

test("only the person's own picture is removed, whatever its extension", async () => {
  const w = setup({ files: [{ name: `${USER.id}.jpg` }, { name: `${OTHER}.png` }, { name: `${USER.id}.webp` }] });
  await post();
  assert.deepEqual(w.removed, [`avatars/${USER.id}.jpg`, `avatars/${USER.id}.webp`]);
  assert.deepEqual(w.events[1], ["list", "avatars", "avatars", USER.id]);
});

test("no picture: nothing to remove, the sign-in still goes", async () => {
  const w = setup({ files: [] });
  assert.equal((await post()).status, 200);
  assert.deepEqual(names(w.events), ["rpc", "list", "deleteUser"]);
});

test("a refusal from the database stops everything: no picture touched, sign-in kept", async () => {
  for (const [answer, status, code] of [
    [{ ok: false, code: "ACCOUNT_HAS_PENDING" }, 409, "ACCOUNT_HAS_PENDING"],
    [{ ok: false, code: "FORBIDDEN" }, 403, "forbidden"],
  ]) {
    const w = setup({ rpc: () => answer });
    const r = await post();
    assert.equal(r.status, status);
    assert.equal(r.json.error, code);
    assert.deepEqual(names(w.events), ["rpc"], "nothing after the refusal");
  }
});

test("a database error, an exception or an answer nobody agreed to is a failure, and the sign-in stays", async () => {
  const cases = [
    () => { throw Object.assign(new Error("database down"), { code: "XX000" }); },
    () => null,
    () => ({}),
    () => ({ ok: "yes" }),
    () => ({ ok: false }),
    () => ({ ok: false, code: "lower case" }),
    () => "ok",
  ];
  for (const rpc of cases) {
    const w = setup({ rpc });
    const r = await post();
    assert.equal(r.status, 500, JSON.stringify(rpc.toString()));
    assert.equal(r.json.error, "upstream_error");
    assert.deepEqual(names(w.events), ["rpc"]);
  }
});

test("a repeat after a later step failed: ALREADY_DELETED goes on to the picture and the sign-in", async () => {
  const w = setup({ rpc: () => ({ ok: false, code: "ALREADY_DELETED" }) });
  const r = await post();
  assert.equal(r.status, 200);
  assert.deepEqual(names(w.events), ["rpc", "list", "deleteUser"]);
});

test("the picture cannot be listed or removed: stop before the sign-in goes, so a retry is possible", async () => {
  let w = setup({ listError: "storage down" });
  let r = await post();
  assert.equal(r.status, 500);
  assert.equal(r.json.error, "cleanup_failed");
  assert.ok(!names(w.events).includes("deleteUser"));

  w = setup({ files: [{ name: `${USER.id}.png` }], removeError: "storage down" });
  r = await post();
  assert.equal(r.status, 500);
  assert.equal(r.json.error, "cleanup_failed");
  assert.ok(!names(w.events).includes("deleteUser"));
});

test("the sign-in cannot be removed: an error, and the same request can be sent again", async () => {
  setup({ deleteError: { message: "boom", status: 500 } });
  const r = await post();
  assert.equal(r.status, 500);
  assert.equal(r.json.error, "auth_delete_failed");
});

test("a sign-in that is already gone counts as done", async () => {
  setup({ deleteError: { message: "User not found", status: 404 } });
  assert.equal((await post()).status, 200);
});

test("no confirmation, no sign-in token: nothing is called", async () => {
  for (const body of [undefined, {}, { confirm: false }, { confirm: "true" }, { confirm: 1 }]) {
    const w = setup();
    const r = route.POST(new Request("http://localhost/x", { method: "POST", body: body === undefined ? "not json" : JSON.stringify(body) }));
    assert.equal((await r).status, 400);
    assert.deepEqual(w.events, []);
  }
  const w = setup({ user: null });
  const res = await route.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ confirm: true }) }));
  assert.equal(res.status, 401);
  assert.deepEqual(w.events, []);
});
