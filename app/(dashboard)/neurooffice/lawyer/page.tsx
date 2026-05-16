"use client";

import { useState } from "react";
import AgentPageShell from "@/components/neurooffice/AgentPageShell";
import AgentTabs from "@/components/neurooffice/AgentTabs";

const TABS = [
  { id: "contract-template", label: "Contract Template" },
  { id: "risk-analysis",     label: "Risk Analysis" },
  { id: "legal-explanation", label: "Legal Explanation" },
];

const PLACEHOLDERS: Record<string, string> = {
  "contract-template": "e.g. Freelance web development agreement between contractor and client",
  "risk-analysis":     "e.g. We want to launch a food delivery app using independent contractors in the EU",
  "legal-explanation": "e.g. What is GDPR and how does it affect my e-commerce store?",
};

const LABELS: Record<string, string> = {
  "contract-template": "Describe the contract you need",
  "risk-analysis":     "Describe the situation or business model to analyze",
  "legal-explanation": "What legal concept do you want explained?",
};

export default function LawyerPage() {
  const [tab, setTab] = useState("contract-template");
  const [input, setInput] = useState("");

  return (
    <AgentPageShell
      agentType="lawyer"
      emoji="⚖️"
      name="Lawyer"
      description="Contract templates, risk analysis, legal guidance"
      disclaimer={
        <span>
          ⚠️ <strong>Legal Disclaimer:</strong> NeuroOffice Lawyer provides general legal information and templates
          for educational purposes only. Always consult a qualified attorney for binding legal advice.
        </span>
      }
      buildPayload={() => ({ input, tab })}
      generateDisabled={!input.trim()}
    >
      <AgentTabs tabs={TABS} active={tab} onChange={(id) => { setTab(id); setInput(""); }} />
      <div>
        <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">{LABELS[tab]}</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={PLACEHOLDERS[tab]}
          rows={5}
          className="input-field resize-none"
          style={{ minHeight: 120 }}
        />
      </div>
    </AgentPageShell>
  );
}
