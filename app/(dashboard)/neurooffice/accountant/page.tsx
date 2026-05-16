"use client";

import { useState } from "react";
import AgentPageShell from "@/components/neurooffice/AgentPageShell";
import AgentTabs from "@/components/neurooffice/AgentTabs";
import { BarChart3 } from "lucide-react";

const TABS = [
  { id: "tax-planning",       label: "Tax Planning" },
  { id: "cost-optimization",  label: "Cost Optimization" },
  { id: "financial-report",   label: "Financial Report" },
];

const PLACEHOLDERS: Record<string, string> = {
  "tax-planning":      "e.g. Freelancer in Germany earning €80k/year, looking to minimize income tax",
  "cost-optimization": "e.g. SaaS company with €12k/month in expenses: €4k hosting, €3k salaries, €2k marketing, €3k tools",
  "financial-report":  "",
};

const LABELS: Record<string, string> = {
  "tax-planning":      "Describe your tax situation",
  "cost-optimization": "Describe your current expenses",
  "financial-report":  "",
};

export default function AccountantPage() {
  const [tab, setTab] = useState("tax-planning");
  const [input, setInput] = useState("");
  const isAutoTab = tab === "financial-report";

  return (
    <AgentPageShell
      agentType="accountant"
      emoji="🧾"
      name="Accountant"
      description="Tax planning, financial reports, cost optimization"
      buildPayload={() => ({ input: isAutoTab ? "" : input, tab })}
      generateDisabled={!isAutoTab && !input.trim()}
    >
      <AgentTabs tabs={TABS} active={tab} onChange={(id) => { setTab(id); setInput(""); }} />

      {isAutoTab ? (
        <div
          className="flex flex-col items-center justify-center py-8 rounded-2xl text-center"
          style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)" }}
        >
          <div
            className="w-12 h-12 rounded-2xl gold-gradient flex items-center justify-center mb-3 shadow-[0_2px_8px_rgba(245,166,35,0.3)]"
          >
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <p className="font-semibold text-sm text-[#1A1A1A] mb-1">Auto-generated from your account</p>
          <p className="text-xs text-[#6B6B6B]">
            Your real transaction data will be pulled from your account and analyzed
          </p>
        </div>
      ) : (
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
      )}
    </AgentPageShell>
  );
}
