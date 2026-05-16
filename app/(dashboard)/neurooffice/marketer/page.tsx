"use client";

import { useState } from "react";
import AgentPageShell from "@/components/neurooffice/AgentPageShell";

export default function MarketerPage() {
  const [input, setInput] = useState("");

  return (
    <AgentPageShell
      agentType="marketer"
      emoji="📢"
      name="Marketer"
      description="Content plans, ad campaigns, and creative ideas"
      buildPayload={() => ({ input })}
      generateDisabled={!input.trim()}
    >
      <div>
        <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
          Describe your business or marketing task
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Promote a coffee shop to office workers"
          rows={5}
          className="input-field resize-none"
          style={{ minHeight: 120 }}
        />
      </div>
    </AgentPageShell>
  );
}
