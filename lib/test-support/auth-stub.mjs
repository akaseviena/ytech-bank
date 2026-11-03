// Stand-in for lib/mobile/auth.ts, see route-hooks.mjs.
export const admin = new Proxy({}, { get: (_t, key) => globalThis.__routeTest.db[key] });

export async function requireUser() {
  return globalThis.__routeTest.user;
}
