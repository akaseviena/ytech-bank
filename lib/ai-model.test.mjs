import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AI_MODEL } from "./ai-model.ts";

// One model for every AI call, named in one place. The privacy policy and the App Privacy answers
// were checked against this model (retention, training); a second route quietly using another
// model would make both untrue without a single test failing.

const root = fileURLToPath(new URL("../", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "test-support", "recon", "docs", "supabase"]);

function sources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) && !/\.test\.mjs$/.test(entry.name)) out.push(full);
  }
  return out;
}
const rel = (f) => path.relative(root, f).replaceAll("\\", "/");

test("the model is the one the privacy policy and the App Privacy answers were checked for", () => {
  assert.equal(
    AI_MODEL,
    "claude-sonnet-5",
    "the retention and training statements in app/privacy/page.tsx and the App Privacy answers were checked for claude-sonnet-5; check them for the new model before changing this",
  );
});

test("no string naming a model exists anywhere in the code except lib/ai-model.ts", () => {
  const found = [];
  for (const dir of ["app", "components", "contexts", "lib", "scripts", "types"]) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const file of sources(full)) {
      if (rel(file) === "lib/ai-model.ts") continue;
      fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
        if (/claude-[a-z0-9]/i.test(line)) found.push(`${rel(file)}:${i + 1}  ${line.trim()}`);
      });
    }
  }
  assert.deepEqual(found, [], "a model is named outside lib/ai-model.ts");
});

test("each of the four AI routes sends AI_MODEL, with no literal model beside it", () => {
  const routes = ["app/api/ai/route.ts", "app/api/neurooffice/route.ts", "app/api/mobile/ai/chat/route.ts", "app/api/mobile/ai/neurooffice/route.ts"];
  for (const r of routes) {
    const text = fs.readFileSync(path.join(root, r), "utf8");
    assert.match(text, /import \{ AI_MODEL \} from "@\/lib\/ai-model"/, `${r} imports the constant`);
    assert.match(text, /\bmodel: AI_MODEL,/, `${r} sends it`);
    // a literal is `model: "name"`; the log line's `model:", AI_MODEL` is a label followed by the constant
    assert.doesNotMatch(text, /\bmodel:\s*["'`][A-Za-z]/, `${r} has a literal model`);
  }
});
