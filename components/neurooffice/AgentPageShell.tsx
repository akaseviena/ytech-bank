"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Copy, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import GoldButton from "@/components/ui/GoldButton";
import PageTransition from "@/components/ui/PageTransition";
import type { AgentType } from "@/types";

interface AgentPageShellProps {
  agentType: AgentType;
  emoji: string;
  name: string;
  description: string;
  buildPayload: () => Record<string, unknown>;
  generateDisabled?: boolean;
  disclaimer?: React.ReactNode;
  children: React.ReactNode;
}

export default function AgentPageShell({
  agentType,
  emoji,
  name,
  description,
  buildPayload,
  generateDisabled = false,
  disclaimer,
  children,
}: AgentPageShellProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const payload = buildPayload();
      const res = await fetch("/api/neurooffice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType, ...payload }),
      });
      const data = await res.json() as { result?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Generation failed"); return; }
      setResult(data.result ?? "");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <PageTransition>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Back */}
        <Link
          href="/neurooffice"
          className="inline-flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#F5A623] transition-colors mb-6 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          NeuroOffice
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{
              background: "rgba(245,166,35,0.1)",
              border: "1.5px solid rgba(245,166,35,0.3)",
            }}
          >
            {emoji}
          </div>
          <div>
            <h1 className="font-bold text-2xl text-[#1A1A1A]">{name}</h1>
            <p className="text-sm text-[#6B6B6B] mt-0.5">{description}</p>
          </div>
        </div>

        {/* Disclaimer */}
        {disclaimer && (
          <div
            className="mb-6 p-4 rounded-2xl text-sm text-[#6B6B6B] leading-relaxed"
            style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)" }}
          >
            {disclaimer}
          </div>
        )}

        {/* Input area */}
        <div
          className="rounded-[20px] p-6 mb-5"
          style={{ background: "#FFFFFF", border: "1px solid #F0F0F0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
        >
          {children}

          <GoldButton
            onClick={handleGenerate}
            loading={loading}
            disabled={generateDisabled || loading}
            size="lg"
            className="w-full mt-5"
          >
            {loading ? "Thinking…" : "Generate"}
          </GoldButton>
        </div>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-4 py-3 mb-4 rounded-2xl"
              style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)" }}
            >
              <Loader2 className="w-5 h-5 text-[#F5A623] animate-spin flex-shrink-0" />
              <span className="text-sm font-semibold text-[#F5A623]">Thinking…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-2xl text-sm text-[#FF3B30] font-medium"
            style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)" }}
          >
            {error}
          </motion.div>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-[20px] overflow-hidden"
              style={{
                background: "#FFFFFF",
                border: "1px solid #F0F0F0",
                borderLeft: "4px solid #F5A623",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #F5F5F5" }}>
                <span className="font-bold text-sm text-[#1A1A1A]">Result</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#6B6B6B] hover:text-[#F5A623] transition-colors px-3 py-1.5 rounded-xl hover:bg-[rgba(245,166,35,0.06)] border border-transparent hover:border-[rgba(245,166,35,0.3)]"
                >
                  {copied ? (
                    <><Check className="w-3.5 h-3.5 text-[#34C759]" /> Copied!</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copy</>
                  )}
                </button>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">{result}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
