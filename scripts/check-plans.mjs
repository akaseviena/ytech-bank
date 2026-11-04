// Pre-release check: lib/plans.ts against the plan table the server publishes.
//
//   CHECK_BASE_URL=https://<the deployed app> npm run check:plans
//
// Exits 1 and says what differs when the hand-written copy and the server disagree, or when a
// charge note the server will write is not one the AI-context filter recognises. See
// lib/plan-check.ts. (The app's repository runs the same comparison for its own copy.)
import { register } from "node:module";


register("file:///" + new URL("../lib/test-support/alias-hooks.mjs", import.meta.url).pathname.replace(/^\//, ""));

const base = process.env.CHECK_BASE_URL;
if (!base) {
  console.error("Set CHECK_BASE_URL to the address of the deployed app, e.g. https://example.vercel.app");
  process.exit(2);
}

const root = new URL("../", import.meta.url);
const { PLAN_PRICE_PENCE, PLAN_PURCHASABLE } = await import(new URL("lib/plans.ts", root).href);
const { comparePlans } = await import(new URL("lib/plan-check.ts", root).href);

const res = await fetch(new URL("/api/mobile/plans", base), { cache: "no-store" });
if (!res.ok) {
  console.error(`GET /api/mobile/plans answered ${res.status}`);
  process.exit(2);
}
const { plans } = await res.json();

const problems = comparePlans(plans, { prices: PLAN_PRICE_PENCE, purchasable: PLAN_PURCHASABLE });
if (problems.length) {
  console.error("lib/plans.ts and the server's plan table disagree:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`ok: ${plans.length} plans, prices and purchasability agree, every charge note is a recognised one`);

