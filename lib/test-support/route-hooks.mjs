// Lets `node --test` run a real API route (app/api/**/route.ts) against stand-ins: the Anthropic
// SDK, next/server, lib/mobile/auth (the signed-in user and the service-role database) and
// lib/supabase/server (the web's signed-in client) and lib/supabase/admin (its service-role client)
// are replaced; everything else in the route is
// the real code. Register it after alias-hooks.mjs. The stand-ins read what to do from
// globalThis.__routeTest, set by the test.
const sdk = new URL("./anthropic-stub.mjs", import.meta.url).href;
const auth = new URL("./auth-stub.mjs", import.meta.url).href;
const server = new URL("./supabase-server-stub.mjs", import.meta.url).href;
const adminClient = new URL("./supabase-admin-stub.mjs", import.meta.url).href;
const nextServer = new URL("./next-server-stub.mjs", import.meta.url).href;

export async function resolve(spec, ctx, next) {
  if (spec === "@anthropic-ai/sdk") return { url: sdk, shortCircuit: true };
  if (spec === "next/server") return { url: nextServer, shortCircuit: true };
  const resolved = await next(spec, ctx);
  if (resolved.url.endsWith("/lib/mobile/auth.ts")) return { url: auth, shortCircuit: true };
  if (resolved.url.endsWith("/lib/supabase/admin.ts")) return { url: adminClient, shortCircuit: true };
  if (resolved.url.endsWith("/lib/supabase/server.ts")) return { url: server, shortCircuit: true };
  return resolved;
}
