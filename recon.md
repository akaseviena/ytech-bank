# Red-team recon — AI Assistant & NeuroOffice

Scope: data-plane injection + user isolation only. No fund-movement testing (AI Assistant/NeuroOffice cannot execute transfers today — confirmed below). Phase 0 only — recon, no fixes.

Four entry points exist, all confirmed by exhaustive grep (`tools:\s*\[|tool_use|anthropic\.messages\.(create|stream)` → exactly these 4 files, nothing else in the repo touches the Anthropic SDK):

| Route | Surface | Auth | DB access |
|---|---|---|---|
| `app/api/ai/route.ts` | Web — AI Assistant | `supabase.auth.getUser()` (cookie session) | Browser-equivalent server client, RLS-enforced |
| `app/api/neurooffice/route.ts` | Web — NeuroOffice (8 agents) | same | same |
| `app/api/mobile/ai/chat/route.ts` | Mobile — AI Assistant | Bearer token → `admin.auth.getUser(token)` | **service-role `admin` client — bypasses RLS entirely** |
| `app/api/mobile/ai/neurooffice/route.ts` | Mobile — NeuroOffice | same | same |

---

## 1. System prompts

### AI Assistant — web (`app/api/ai/route.ts:49-57`)

```
You are a personal AI financial assistant for Y-tech. You are helpful, warm, and professional.
Respond in the user's language (detect from their message — English or Russian).
Always be specific and reference real numbers from the user's data.

Be encouraging and actionable. Never advise on external investments. Only discuss Y-tech services and the user's data.

Be concise. [...formatting rules...]
```

Then per-request `userContext` (profile + balance + spend windows + last-30 transactions + goals) is appended as a second `system` block. **No instruction anywhere tells the model that transaction/goal text is untrusted data rather than something to act on.**

### AI Assistant — mobile (`lib/mobile/prompts.ts:6-62`)

Longer and more structured (~550 words). Explicitly says: *"You have access to the user's real financial data... This data appears in the conversation context and reflects their actual situation."* Still no untrusted-data framing — the model is told the data is real and authoritative, not that hostile text could be embedded in it.

### NeuroOffice — web, 8 agents (`app/api/neurooffice/route.ts:31-75`)

Each agent (marketer, copywriter, hr-manager, client-manager, consultant, designer, lawyer, accountant) gets its own persona prompt + a shared `FORMATTING` suffix. Same pattern: financial context appended as a second system block, no untrusted-data framing.

### NeuroOffice — mobile, 8 agents (`lib/mobile/prompts.ts:64-314`)

Same 8 personas, much longer (each ~500-900 words), same absence of injection-defense framing.

**Conclusion: zero injection-specific defenses exist at the prompt level, on any of the 4 surfaces.** This is expected — it's exactly what Phase 1 needs to test.

---

## 2. Tool/function schema

**There are none.** All four routes call `anthropic.messages.create()` / `.stream()` with no `tools` parameter. This is pure RAG: server-side code queries Postgres, formats results as a text block, drops it into `system`, and the model produces a text reply. There is no function-calling surface, so there is no tool-argument channel for the model to influence at all.

This substantially narrows Phase 1:
- **Point 2's "read vs. state-touching" split is moot** — the "touches state" column is empty. Nothing the model does can reach a write. This also means **Phase 1's class A payloads cannot escalate past "the model says something wrong in its reply."** There is no tool call for a successful injection to hijack.
- The isolation question in point 5 (**"could the model influence what user_id gets used in a tool call?"**) doesn't apply in its literal form — there's no tool call. The real equivalent question, which Phase 1 D1 will test, is: **can anything in the user-supplied request (chat message, injected transaction text) change whose data gets fetched?** Based on code inspection: no — `user.id`/`user_id` never comes from the request body on any of the 4 routes (see §5). But this needs empirical confirmation, not just a prompt-level test, since the model isn't the only actor — the client-side JS is too (see the mobile conversation-hijack note in §4).

---

## 3. Transaction text → model context (verbatim)

Every route independently fetches transactions and interpolates `description` directly, no sanitization, no length cap, no character filtering.

**Web AI Assistant** — `app/api/ai/route.ts:145-148`:
```ts
const recentTxStr = recentTxs.map((t) => {
  const dir = t.sender_id === user.id ? "Sent" : "Received";
  return `${dir} £${Number(t.amount).toFixed(2)} (${t.category}${t.description ? " — " + t.description : ""})`;
}).join("\n");
```
→ interpolated into `userContext` at line 179 (`RECENT TRANSACTIONS ... ${recentTxStr}`), which becomes a `system` block.

**Web NeuroOffice** — `app/api/neurooffice/route.ts:257-260`, identical shape:
```ts
const recentTxList = recentTxs.map((t) => {
  const dir = t.sender_id === user.id ? "Sent" : "Received";
  return `  ${dir} £${Number(t.amount).toFixed(2)} · ${t.category}${t.description ? " — " + t.description : ""}`;
}).join("\n") || "  None";
```

**Mobile AI Assistant** — `lib/mobile/financial-context.ts:66-72`:
```ts
const recentLines =
  txs
    .map((t) => {
      const dir = t.sender_id === userId ? "Sent" : "Received";
      return `  ${dir} ${s}${Number(t.amount).toFixed(2)} · ${t.category}${t.description ? " — " + t.description : ""}`;
    })
    .join("\n") || "  None";
```

**Mobile NeuroOffice (accountant)** — same file, `buildAgentContext`, lines ~126-152: fetches `description` in the `select()` but the accountant's rendered `catLines` only aggregates by category/amount — description text isn't rendered into that particular block. Worth flagging: this means the accountant sub-context happens *not* to carry `description`, but every other context builder (assistant on both platforms, and every other NeuroOffice agent that calls `buildAssistantContext`-equivalent data) does.

**No `merchant` field exists anywhere** — confirmed by grep and by the `transactions` table definition (`supabase/schema.sql:21-33`): columns are `id, sender_id, receiver_id, amount, description, category, type, status, created_at`. No merchant/counterparty-name column, and no route ever joins the counterparty's `first_name`/`last_name` into the AI context either (only `sender_id` is selected, used solely to compute "Sent"/"Received"). **This closes the literal A4 vector as worded** (there's no `merchant` field to set to "Y-tech Security") — but the *substance* of A4 is still reachable entirely through `description`, since that's freely settable by whoever sends the money (`p_description` on `transfer_funds`, or `description` on `POST /api/transfer`) and is never validated beyond existing as a string. Phase 1's A4 payload will be adapted to put the impersonation text inside `description` rather than a nonexistent `merchant` field.

**Root cause, all 4 paths:** raw string interpolation of attacker-controlled text into a prompt block, no shared sanitizer, no fence, no length cap. This is one function's worth of logic duplicated 4 times with the same gap in each copy.

---

## 4. Memory / conversation persistence

**No fact-extraction exists anywhere.** Grepped for `extract|memory|summariz|\bfact\b` across `app/`, `lib/`, `components/` — zero matches. Nothing reads a tool result (there are no tool results) or a model reply and distills it into a separate "facts about the user" store. The only persistence is raw transcript storage: the full message array, verbatim, in `ai_conversations` (web + mobile AI Assistant) or `neurooffice_conversations` (web NeuroOffice) / `ai_conversations` again (mobile NeuroOffice, keyed by conversation id).

That said, **raw transcript replay is itself a vector worth naming**, even without a dedicated extractor: if a reply is ever successfully steered by injected transaction text, that reply is saved verbatim and re-sent as `conversationHistory` on the next turn — and, since these conversations persist across page reloads/days (`ai-assistant/page.tsx` reloads from `localStorage` + Supabase on mount), potentially across sessions. This is what A6 will test — not "does a memory tool get poisoned" (there isn't one) but "does a poisoned assistant statement survive into the stored transcript and get replayed."

**Isolation detail worth flagging now, to be confirmed empirically in Phase 1 (D2):** the two persistence paths use different Supabase clients with different enforcement:

- **Web** (`ai-assistant/page.tsx:139-145`, `AgentPageShell.tsx:158-165`) uses the **browser client** (`@/lib/supabase/client`, subject to RLS). Writes are `upsert({ id: convIdRef.current, user_id: userIdRef.current, ... })` where `convIdRef.current` is a UUID generated **client-side** and stored in `localStorage`, but RLS policy `"own conversations" ON ai_conversations FOR ALL USING (auth.uid() = user_id)` still gates every write at the database layer regardless of what `id` is supplied.
- **Mobile** (`app/api/mobile/ai/chat/route.ts:71-76`, `.../neurooffice/route.ts:121-126`) uses the **service-role `admin` client**, which bypasses RLS entirely. The read is correctly scoped (`.eq("id", conversationId).eq("user_id", user.id)`), but the **upsert is not**: `admin.from("ai_conversations").upsert({ id: conversationId, user_id: user.id, ... })` — `conversationId` comes from the client-supplied request body (`z.string().uuid().nullable()`), and if it collides with an existing row's primary key, upsert will overwrite that row's `user_id` and `messages`, regardless of who currently owns it. The two post-stream `.update()` calls (`chat/route.ts:128-131`, `neurooffice/route.ts:191-194`) filter only `.eq("id", conversationId)` — no `user_id` check at all.

  Exploitability depends on knowing/guessing another user's `conversationId` (a v4 UUID — not guessable by brute force), so this is **not equivalent to D1** (no user-supplied input yields another user's data on demand). But it means **ownership is enforced on read and not on write**, on the one client (mobile, service-role) where RLS isn't there as a backstop. This will be tested directly in Phase 1 as an extension of the isolation class, and reported on its own line in findings.md rather than folded into D1, since its risk shape (conversation hijack/corruption given a known ID) is different from D1 (data disclosure via chat).

---

## 5. User isolation — how `user_id` reaches each query

**Web (`app/api/ai/route.ts:62-64`, `app/api/neurooffice/route.ts:112-121`):**
```ts
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```
`user.id` is the only identifier used in every subsequent query (`.eq("id", user.id)`, `.or(\`sender_id.eq.${user.id},receiver_id.eq.${user.id}\`)`). The parsed request body (`{ message, conversationHistory }` for AI Assistant; `{ agentType, input, tab, additionalInput, tone, conversationHistory }` for NeuroOffice) **never contains a user identifier field** — confirmed by reading the full `request.json()` destructure on both routes. There is no code path by which a client-supplied value reaches the `user_id` used in a query. The **web routes also run through the standard authenticated Postgres role with RLS enabled** (not service-role), so even a hypothetical bug in the manual `.eq()` filtering would hit RLS as a second gate (`"own profile"`, `"own transactions"` SELECT policy checking `auth.uid() = sender_id OR auth.uid() = receiver_id`, etc.) — see `supabase/schema.sql:137-171`.

**Mobile (`lib/mobile/auth.ts:10-17`):**
```ts
export async function requireUser(req: Request): Promise<User | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
```
`admin.auth.getUser(token)` validates the bearer token server-side against Supabase Auth (cryptographic verification, not a client-trusted claim). `user.id` from this call is threaded through every subsequent query in both mobile routes and in `buildAssistantContext(userId)` / `buildAgentContext(userId, agentId)`. Request bodies are Zod-validated (`agentId`, `input`, `conversationId` only — no user field) — confirmed by reading both schemas in full.

**Bottom line for point 5: on all 4 surfaces, `user_id` is derived exclusively from server-verified auth state — session cookie (web) or Supabase-validated bearer token (mobile) — and never from anything the client, or by extension the model, supplies.** I found no code path where a chat message, a tool argument (none exist), or injected transaction text could change which user's data a query fetches. This will be verified empirically in Phase 1 D1 rather than taken on faith from static reading — but nothing in the code suggests D1 will find a live hole. The one live isolation gap found during recon is the mobile conversation-upsert issue in §4, which is a **different** vulnerability class (write-path ownership, not `user_id` spoofing) and will be tested as its own case.

---

## What Phase 1 will actually test, given the above

- **A1–A7**, adapted: payload goes in `description` (the only attacker-controlled field that reaches every context builder); A4 uses `description` text for the impersonation since no `merchant` field exists.
- **D1**: cross-user data access via chat — asking by email, "switch accounts," injecting a different user's ID into `description`. Expected clean given §5, to be confirmed live.
- **New case D2** (recon-derived, not in the original list): attempt to hijack/overwrite another user's mobile `ai_conversations` row via a guessed-or-obtained `conversationId`, testing the write-path gap found in §4. Lower severity than D1 by construction (requires a known UUID) but real, and cheap to confirm now while we're in this code.

Stopping here per instructions. Awaiting review before Phase 1.
