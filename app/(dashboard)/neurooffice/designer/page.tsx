"use client";

import { useState } from "react";
import AgentPageShell from "@/components/neurooffice/AgentPageShell";
import AgentTabs from "@/components/neurooffice/AgentTabs";

const TABS = [
  { id: "logo-brief",       label: "Logo Brief" },
  { id: "banner-creative",  label: "Banner / Ad" },
  { id: "brand-guidelines", label: "Brand Guidelines" },
];

const PLACEHOLDERS: Record<string, string> = {
  "logo-brief":       "e.g. Tech startup offering AI-powered legal services, targets professionals aged 30-45",
  "banner-creative":  "e.g. Google Display ad for a luxury watch brand, 728x90 and 300x250 sizes",
  "brand-guidelines": "e.g. Boutique wellness brand targeting millennials who value sustainability and mindfulness",
};

const LABELS: Record<string, string> = {
  "logo-brief":       "Describe your brand and what the logo should convey",
  "banner-creative":  "Describe the banner requirements and context",
  "brand-guidelines": "Describe your brand, audience, and values",
};

export default function DesignerPage() {
  const [tab, setTab] = useState("logo-brief");
  const [input, setInput] = useState("");

  return (
    <AgentPageShell
      agentType="designer"
      emoji="🎨"
      name="Designer"
      description="Design briefs, brand guidelines, creative direction"
      disclaimer={
        <span>
          💡 <strong>Note:</strong> NeuroOffice Designer creates detailed creative briefs and design specifications
          that you can use with any design tool or designer.
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
