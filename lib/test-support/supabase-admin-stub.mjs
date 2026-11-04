// Stand-in for lib/supabase/admin.ts, see route-hooks.mjs: the service-role client, here the test's database.
export const supabaseAdmin = new Proxy({}, { get: (_t, key) => globalThis.__routeTest.db[key] });
