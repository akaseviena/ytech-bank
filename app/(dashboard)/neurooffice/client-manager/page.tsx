"use client";

import { useState } from "react";
import AgentPageShell from "@/components/neurooffice/AgentPageShell";
import AgentTabs from "@/components/neurooffice/AgentTabs";

const TABS = [
  { id: "respond-to-review", label: "Respond to Review" },
  { id: "sales-script",      label: "Sales Script" },
  { id: "handle-objection",  label: "Handle Objection" },
];

const TONES = ["professional", "friendly", "apologetic"] as const;
type Tone = typeof TONES[number];

export default function ClientManagerPage() {
  const [tab, setTab] = useState("respond-to-review");
  const [input, setInput] = useState("");
  const [tone, setTone] = useState<Tone>("professional");

  const placeholders: Record<string, string> = {
    "respond-to-review": "Paste the customer review here…",
    "sales-script":      "e.g. SaaS project management tool for small teams, €29/month",
    "handle-objection":  "e.g. 'Your price is too high compared to competitors'",
  };
  const labels: Record<string, string> = {
    "respond-to-review": "Paste the customer review",
    "sales-script":      "Describe your product or service",
    "handle-objection":  "Describe the objection you're facing",
  };

  return (
    <AgentPageShell
      agentType="client-manager"
      emoji="🤝"
      name="Client Manager"
      description="Customer responses, sales scripts, objection handling"
      buildPayload={() => ({ input, tab, tone: tab === "respond-to-review" ? tone : undefined })}
      generateDisabled={!input.trim()}
    >
      <AgentTabs tabs={TABS} active={tab} onChange={(id) => { setTab(id); setInput(""); }} />

      {tab === "respond-to-review" && (
        <div className="mb-4">
          <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Response tone</label>
          <div className="flex gap-2 flex-wrap">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all capitalize"
                style={
                  tone === t
                    ? { background: "rgba(245,166,35,0.1)", borderColor: "#F5A623", color: "#F5A623" }
                    : { borderColor: "#E8E8E8", color: "#6B6B6B" }
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">{labels[tab]}</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholders[tab]}
          rows={5}
          className="input-field resize-none"
          style={{ minHeight: 120 }}
        />
      </div>
    </AgentPageShell>
  );
}
