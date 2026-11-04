import {
  CONTEXT_AGENTS,
  CONTEXT_AGENT_LABEL,
  CONTEXT_FIELDS,
  CONTEXT_FIELD_TEXT,
  NEVER_SENT,
  NOTES_SENT,
  HISTORY_INCOMPLETE,
  RECENT_TRANSFERS_SHOWN,
  TRANSFERS_FOR_TOTALS,
  type ContextAgent,
  type ContextField,
} from "@/lib/context-fields";
import { AGENT_HISTORY_WINDOW, ASSISTANT_HISTORY_WINDOW } from "@/lib/history-window";

// Everything a person is told about what reaches the model, as one object: the field
// table plus the numbers that go with it. The privacy page renders from it and
// GET /api/mobile/ai/context-fields serves it, so a consent screen can be checked
// against what the server really does. The conversation windows come from
// lib/history-window.ts — the constants the four AI routes pass to windowHistory
// (lib/context-fields.test.mjs checks that they do).

export interface ContextLayout {
  /** keyed by the app's agent ids; "assistant" is the main chat */
  agents: Record<ContextAgent, { label: string; fields: ContextField[] }>;
  /** each field in the words the privacy policy uses */
  fields: Record<ContextField, string>;
  recentTransfersShown: number;
  transfersForTotals: number;
  /** how many of the latest saved messages go to the model with a new one */
  conversationWindow: { assistant: number; specialist: number };
  neverSent: string[];
  notesSent: string;
  /** said in each context that carries anything worked out from transfers: the balance includes demo top-ups, which none of it shows */
  historyIncomplete: string;
}

export function contextLayout(): ContextLayout {
  return {
    agents: Object.fromEntries(
      CONTEXT_AGENTS.map((a) => [a, { label: CONTEXT_AGENT_LABEL[a], fields: [...CONTEXT_FIELDS[a]] }]),
    ) as ContextLayout["agents"],
    fields: { ...CONTEXT_FIELD_TEXT },
    recentTransfersShown: RECENT_TRANSFERS_SHOWN,
    transfersForTotals: TRANSFERS_FOR_TOTALS,
    conversationWindow: { assistant: ASSISTANT_HISTORY_WINDOW, specialist: AGENT_HISTORY_WINDOW },
    neverSent: [...NEVER_SENT],
    notesSent: NOTES_SENT,
    historyIncomplete: HISTORY_INCOMPLETE,
  };
}
