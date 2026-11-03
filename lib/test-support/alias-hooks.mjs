// Lets `node --test` import the app's TypeScript the way Next does: "@/lib/x" resolves to
// the repo root, and a relative import without an extension finds the .ts file.
// Used only by tests that run the real context builders (lib/canary.test.mjs).
import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) {
    const base = path.join(root, spec.slice(2));
    for (const ext of [".ts", ".tsx", ".js", "/index.ts"]) {
      if (fs.existsSync(base + ext)) return next(pathToFileURL(base + ext).href, ctx);
    }
  }
  if (spec.startsWith("./") && ctx.parentURL?.endsWith(".ts")) {
    const base = path.join(path.dirname(fileURLToPath(ctx.parentURL)), spec);
    if (!path.extname(spec) && fs.existsSync(base + ".ts")) return next(pathToFileURL(base + ".ts").href, ctx);
  }
  return next(spec, ctx);
}
