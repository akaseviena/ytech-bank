// What the model is given about a person, per assistant or agent. One table.
//
// Every place that builds a prompt (lib/mobile/financial-context.ts for the app,
// lib/web-context.ts for the web assistant and NeuroOffice) asks this table which
// fields to read and print, and reads nothing else. The privacy policy page renders
// its list from the same table. So what a person is told and what is sent cannot
// drift apart by one side being edited and the other forgotten: changing what an
// agent receives is a change in this file, and in no other.
//
// CHANGING THIS FILE CHANGES WHAT THE APP'S CONSENT SCREEN MUST SAY. There are two consent
// texts and one table: this page's /privacy renders from it automatically, the app's screen
// is written by hand on the mobile side. Tell the founder whenever this file changes; the
// app's pre-release check compares its copy with GET /api/mobile/ai/context-fields and fails
// on any difference.
//
// Erasable TypeScript only, so `node --test` can run lib/context-fields.test.mjs
// against this file directly.

/** Newest transfers listed one by one (the assistant only). */
export const RECENT_TRANSFERS_SHOWN = 20;
/** Newest transfers added up for the accountant's income / expense totals. */
export const TRANSFERS_FOR_TOTALS = 50;

/** Each field, in the words the privacy policy uses for it. */
export const CONTEXT_FIELD_TEXT = {
  plan: "Your plan, for example Basic or Metal",
  balance: "Your account balance",
  month_spent: "How much you have spent this month",
  month_received: "How much you have received this month",
  month_business_spent: "How much of this month's spending was in the business category",
  month_categories: "Your spending this month, by category",
  month_vs_previous: "Money in, money out and the difference, for this month and for last month",
  last_transfers_totals: `Money in, money out and the difference over your ${TRANSFERS_FOR_TOTALS} most recent transfers`,
  recent_transfers: `Your ${RECENT_TRANSFERS_SHOWN} most recent transfers, one by one: the amount, whether you sent or received it, and its category`,
  runway: "An estimate of how many days your balance would last at the pace of the last 30 days, when there is enough history to give one",
  goals: "Your savings goals: name, target, amount saved and deadline",
} as const;

export type ContextField = keyof typeof CONTEXT_FIELD_TEXT;

export const CONTEXT_AGENTS = [
  "assistant",
  "accountant",
  "consultant",
  "marketer",
  "copywriter",
  "designer",
  "hr",
  "client_manager",
  "lawyer",
] as const;

export type ContextAgent = (typeof CONTEXT_AGENTS)[number];

export const CONTEXT_FIELDS: Record<ContextAgent, readonly ContextField[]> = {
  assistant: ["plan", "balance", "month_spent", "month_received", "month_categories", "recent_transfers", "goals"],
  accountant: ["balance", "last_transfers_totals", "month_categories"],
  consultant: ["balance", "month_vs_previous", "month_categories", "runway"],
  marketer: ["balance", "month_spent", "month_business_spent"],
  copywriter: ["balance"],
  designer: ["balance"],
  hr: ["balance"],
  client_manager: ["balance"],
  lawyer: ["balance"],
};

/** What is never part of the context, whichever agent it is. */
export const NEVER_SENT: readonly string[] = [
  "your name",
  "your email address, phone number or date of birth",
  "your card details",
  "the names or account details of the people you pay or who pay you",
];

/**
 * The one exception to "notes are not sent": see lib/transfer-note.ts.
 *
 * This is true because demo top-ups and the welcome bonus are on the promo rail, which no context
 * reads: the filter would let their notes through ("Demo top-up", "Welcome demo balance"), so if
 * those ever move to a rail that is read, this sentence must name them too.
 */
export const NOTES_SENT =
  "The notes people type on a payment are not sent either; the only notes included are the fixed texts of Y-tech's own subscription charges.";

/**
 * Said in every context that carries anything worked out from transfers, because that history is
 * not the whole story: demo top-ups are on the promo rail on purpose (on a rail that is read they
 * would distort the runway, "received this month" and month-on-month), so the balance includes money
 * the figures below do not show. Without the sentence the gap reads as an error. It is one sentence
 * for all of them, and says nothing about what kind of figure follows, so it stays true if another
 * rail drops out of the context. It is a sentence, not a field, so it sits in the shared layout
 * (contextLayout().historyIncomplete) where the pre-release check sees it; the words are fixed by
 * the mobile side, which tests that the consent text does not need to change for it.
 */
export const HISTORY_INCOMPLETE = "The balance includes demo top-ups. They do not appear in anything below.";

/** Fields worked out from transfers, and so affected by what the transfers leave out. */
export const TRANSFER_DERIVED_FIELDS: readonly ContextField[] = [
  "month_spent",
  "month_received",
  "month_business_spent",
  "month_categories",
  "month_vs_previous",
  "last_transfers_totals",
  "recent_transfers",
  "runway",
];

/** Fields that are not (the test makes every field one or the other, so a new one has to be placed). */
export const NOT_FROM_TRANSFERS: readonly ContextField[] = ["plan", "balance", "goals"];

/** Does this set of fields include anything worked out from transfers? Then it comes with HISTORY_INCOMPLETE. */
export function derivesFromTransfers(fields: ReadonlySet<ContextField>): boolean {
  return TRANSFER_DERIVED_FIELDS.some((f) => fields.has(f));
}

export const CONTEXT_AGENT_LABEL: Record<ContextAgent, string> = {
  assistant: "AI Assistant",
  accountant: "Accountant",
  consultant: "Consultant",
  marketer: "Marketer",
  copywriter: "Copywriter",
  designer: "Designer",
  hr: "HR Manager",
  client_manager: "Client Manager",
  lawyer: "Lawyer",
};

// The web names two agents differently from the app.
const ALIASES: Record<string, ContextAgent> = { "hr-manager": "hr", "client-manager": "client_manager" };

/** An agent id from either surface. Throws on an id the table does not know: nothing is sent for it. */
export function contextAgent(id: string): ContextAgent {
  const agent = ALIASES[id] ?? (id as ContextAgent);
  if (!(CONTEXT_AGENTS as readonly string[]).includes(agent)) throw new Error(`No context fields for agent "${id}"`);
  return agent;
}

export function fieldSet(agent: ContextAgent): ReadonlySet<ContextField> {
  return new Set(CONTEXT_FIELDS[agent]);
}

/** Agents that receive exactly the same fields, for listing them together. */
export function fieldGroups(): { agents: ContextAgent[]; fields: readonly ContextField[] }[] {
  const groups: { agents: ContextAgent[]; fields: readonly ContextField[] }[] = [];
  for (const agent of CONTEXT_AGENTS) {
    const fields = CONTEXT_FIELDS[agent];
    const same = groups.find((g) => g.fields.length === fields.length && g.fields.every((f, i) => f === fields[i]));
    if (same) same.agents.push(agent);
    else groups.push({ agents: [agent], fields });
  }
  return groups;
}
