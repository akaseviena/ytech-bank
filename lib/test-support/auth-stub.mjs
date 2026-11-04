// Stand-in for lib/mobile/auth.ts, see route-hooks.mjs.
export const admin = new Proxy({}, { get: (_t, key) => globalThis.__routeTest.db[key] });

// the person's own client, here the test's database
export function clientFor() {
  return globalThis.__routeTest.db;
}

export async function requireUser() {
  return globalThis.__routeTest.user;
}
