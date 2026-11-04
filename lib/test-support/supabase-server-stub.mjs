// Stand-in for lib/supabase/server.ts, see route-hooks.mjs: the signed-in person's client, here the
// test's database (row-level security is not modelled; the test seeds only that person's rows).
export async function createClient() {
  const t = globalThis.__routeTest;
  return {
    auth: { getUser: async () => ({ data: { user: t.user }, error: null }) },
    from: (...args) => t.db.from(...args),
    rpc: (...args) => t.db.rpc(...args),
  };
}
