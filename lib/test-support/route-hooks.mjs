// Lets `node --test` run a real API route (app/api/mobile/ai/*/route.ts) against stand-ins:
// the Anthropic SDK and lib/mobile/auth (the signed-in user and the service-role database)
// are replaced; everything else in the route is the real code. Register it after
// alias-hooks.mjs. The stand-ins read what to do from globalThis.__routeTest, set by the test.
const sdk = new URL("./anthropic-stub.mjs", import.meta.url).href;
const auth = new URL("./auth-stub.mjs", import.meta.url).href;

export async function resolve(spec, ctx, next) {
  if (spec === "@anthropic-ai/sdk") return { url: sdk, shortCircuit: true };
  const resolved = await next(spec, ctx);
  if (resolved.url.endsWith("/lib/mobile/auth.ts")) return { url: auth, shortCircuit: true };
  return resolved;
}
