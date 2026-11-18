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
function setup({ rpc = () => ({ ok: true }), files = [], listError = null, removeError = null, deleteError = null, markError = null, user = USER } = {}) {
  const events = [];
  const removed = [];
  // the request the database function records (what it does is the other side's; here it is a row)
  const deletions = [
    { id: "d-1", user_id: USER.id, plan_at_deletion: "standard", requested_at: "2026-11-18T10:00:00Z", auth_deleted_at: null },
    { id: "d-2", user_id: OTHER, plan_at_deletion: "basic", requested_at: "2026-11-18T09:00:00Z", auth_deleted_at: null },
    { id: "d-0", user_id: null, plan_at_deletion: "basic", requested_at: "2026-11-01T09:00:00Z", auth_deleted_at: "2026-11-01T09:00:01Z" },
  ];
  const db = fakeDb({ account_deletions: deletions }, { rpc: { [DELETE_ACCOUNT_RPC]: (args) => { events.push(["rpc", args]); return rpc(args); } } });
  const realFrom = db.from;
  db.from = (table) => {
    const b = realFrom(table);
    if (table !== "account_deletions") return b;
    const then = b.then;
    b.then = (res, rej) => { events.push(["mark"]); return markError ? Promise.reject(markError).then(res, rej) : then.call(b, res, rej); };
    return b;
  };
  db.storage = {
    from: (bucket) => ({
      list: async (folder, opts) => { events.push(["list", bucket, folder, opts.search]); return listError ? { data: null, error: { message: listError } } : { data: files, error: null }; },
      remove: async (names) => { events.push(["remove", bucket, names]); removed.push(...names); return { data: [], error: removeError ? { message: removeError } : null }; },
    }),
  };
  db.auth = { admin: { deleteUser: async (id) => { events.push(["deleteUser", id]); return { data: null, error: deleteError }; } } };
  globalThis.__routeTest = { db, user };
  return { events, removed, deletions };
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
  assert.deepEqual(names(w.events), ["rpc", "list", "remove", "deleteUser", "mark"]);
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
  assert.deepEqual(names(w.events), ["rpc", "list", "deleteUser", "mark"]);
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
  assert.deepEqual(names(w.events), ["rpc", "list", "deleteUser", "mark"]);
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

test("a sign-in that is already gone counts as done, and the request is marked", async () => {
  const w = setup({ deleteError: { message: "User not found", status: 404 } });
  assert.equal((await post()).status, 200);
  assert.equal(w.deletions[0].auth_deleted_at !== null, true);
});

test("after the sign-in is gone the request is marked done: the id is cleared, the time is set, nobody else's row is touched", async () => {
  const w = setup();
  assert.equal((await post()).status, 200);
  const [mine, theirs, old] = w.deletions;
  assert.equal(mine.user_id, null, "the person's id no longer sits in the table");
  assert.ok(Date.parse(mine.auth_deleted_at) > 0);
  assert.equal(mine.plan_at_deletion, "standard", "what is kept for reporting is kept");
  assert.equal(theirs.user_id, OTHER);
  assert.equal(theirs.auth_deleted_at, null, "another person's unfinished request is not touched");
  assert.deepEqual(old, { id: "d-0", user_id: null, plan_at_deletion: "basic", requested_at: "2026-11-01T09:00:00Z", auth_deleted_at: "2026-11-01T09:00:01Z" });
});

test("nothing is marked while the person can still sign in: every failure before the sign-in is gone leaves the request open", async () => {
  for (const opts of [
    { rpc: () => ({ ok: false, code: "SOMETHING_ELSE" }) },
    { listError: "storage down" },
    { deleteError: { message: "boom", status: 500 } },
  ]) {
    const w = setup(opts);
    await post();
    assert.equal(w.deletions[0].user_id, USER.id);
    assert.equal(w.deletions[0].auth_deleted_at, null);
    assert.ok(!names(w.events).includes("mark"));
  }
});

test("marking the request fails after the sign-in is gone: still a success, because nobody could repeat it", async () => {
  const w = setup({ markError: new Error("table missing") });
  const r = await post();
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  assert.ok(names(w.events).includes("deleteUser"));
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
