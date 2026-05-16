"use client";

import { useState } from "react";
import AgentPageShell from "@/components/neurooffice/AgentPageShell";

export default function ConsultantPage() {
  const [input, setInput] = useState("");

  return (
    <AgentPageShell
      agentType="consultant"
      emoji="💡"
      name="Consultant"
      description="Business optimization, market analysis, growth ideas"
      buildPayload={() => ({ input })}
      generateDisabled={!input.trim()}
    >
      <div>
        <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
          Describe your business challenge or question
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. How can I increase revenue for my online store?"
          rows={5}
          className="input-field resize-none"
          style={{ minHeight: 120 }}
        />
      </div>
    </AgentPageShell>
  );
}
