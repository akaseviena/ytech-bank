"use client";

import { useState } from "react";
import AgentPageShell from "@/components/neurooffice/AgentPageShell";

type Mode = "create" | "improve";

export default function CopywriterPage() {
  const [mode, setMode] = useState<Mode>("create");
  const [input, setInput] = useState("");
  const [original, setOriginal] = useState("");

  return (
    <AgentPageShell
      agentType="copywriter"
      emoji="✍️"
      name="Copywriter"
      description="Professional texts, SEO optimization, translations"
      buildPayload={() => ({
        input,
        ...(mode === "improve" ? { additionalInput: original } : {}),
      })}
      generateDisabled={!input.trim() || (mode === "improve" && !original.trim())}
    >
      {/* Mode radio */}
      <div className="flex gap-3 mb-5">
        {(["create", "improve"] as Mode[]).map((m) => (
          <label
            key={m}
            className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold"
            style={{ color: mode === m ? "#F5A623" : "#6B6B6B" }}
          >
            <div
              onClick={() => setMode(m)}
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
              style={{ borderColor: mode === m ? "#F5A623" : "#D0D0D0" }}
            >
              {mode === m && <div className="w-2 h-2 rounded-full gold-gradient" />}
            </div>
            <span onClick={() => setMode(m)}>
              {m === "create" ? "Create new text" : "Improve existing text"}
            </span>
          </label>
        ))}
      </div>

      {mode === "improve" && (
        <div className="mb-4">
          <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Original text to improve</label>
          <textarea
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder="Paste your existing text here…"
            rows={4}
            className="input-field resize-none"
            style={{ minHeight: 100 }}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
          {mode === "create" ? "What text do you need?" : "What should be improved?"}
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "create"
              ? "e.g. Write a product description for eco-friendly water bottles"
              : "e.g. Make it more persuasive and SEO-friendly"
          }
          rows={4}
          className="input-field resize-none"
          style={{ minHeight: 120 }}
        />
      </div>
    </AgentPageShell>
  );
}
