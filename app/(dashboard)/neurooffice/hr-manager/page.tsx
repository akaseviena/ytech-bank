"use client";

import { useState } from "react";
import AgentPageShell from "@/components/neurooffice/AgentPageShell";
import AgentTabs from "@/components/neurooffice/AgentTabs";

const TABS = [
  { id: "job-posting",        label: "Job Posting" },
  { id: "interview-questions", label: "Interview Questions" },
  { id: "employee-survey",    label: "Employee Survey" },
];

const PLACEHOLDERS: Record<string, string> = {
  "job-posting":         "e.g. Senior React Developer, 5+ years experience, remote-friendly startup",
  "interview-questions": "e.g. Senior Software Engineer with focus on system design",
  "employee-survey":     "e.g. Measure team satisfaction and workload balance after recent reorg",
};

const LABELS: Record<string, string> = {
  "job-posting":         "Describe the role you're hiring for",
  "interview-questions": "What position are you interviewing for?",
  "employee-survey":     "What do you want to measure?",
};

export default function HRManagerPage() {
  const [tab, setTab] = useState("job-posting");
  const [input, setInput] = useState("");

  return (
    <AgentPageShell
      agentType="hr-manager"
      emoji="👥"
      name="HR Manager"
      description="Job postings, interview questions, employee assessment"
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
