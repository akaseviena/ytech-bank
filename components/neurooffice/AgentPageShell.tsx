"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Copy, Check, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import GoldButton from "@/components/ui/GoldButton";
import PageTransition from "@/components/ui/PageTransition";
import type { AgentType } from "@/types";

type Message = { role: "user" | "assistant"; content: string };

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatStarted = messages.length > 0;

  useEffect(() => {
    if (chatStarted) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, chatStarted]);

  async function sendToApi(payload: Record<string, unknown>, history: Message[]) {
    const res = await fetch("/api/neurooffice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentType, ...payload, conversationHistory: history }),
    });
    const data = await res.json() as { result?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Generation failed");
    return data.result ?? "";
  }

  async function handleGenerate() {
    const payload = buildPayload();
    const displayText = (payload.input as string | undefined)?.trim() ?? "";
    if (!displayText) return;

    setLoading(true);
    setError("");
    const userMsg: Message = { role: "user", content: displayText };
    setMessages([userMsg]);

    try {
      const result = await sendToApi(payload, []);
      setMessages([userMsg, { role: "assistant", content: result }]);
    } catch (err) {
      setMessages([]);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp() {
    const text = followUp.trim();
    if (!text || loading) return;
    setFollowUp("");
    setError("");

    const history = messages;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await sendToApi({ input: text }, history);
      setMessages((prev) => [...prev, { role: "assistant", content: result }]);
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1));
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(content: string, idx: number) {
    await navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function handleClear() {
    setMessages([]);
    setFollowUp("");
    setError("");
    setShowClearConfirm(false);
  }

  return (
    <PageTransition>
      <div className="p-6 max-w-3xl mx-auto">

        {/* Back + New conversation */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/neurooffice"
            className="inline-flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#F5A623] transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            NeuroOffice
          </Link>

          <AnimatePresence>
            {chatStarted && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#9B9B9B] hover:text-[#F5A623] transition-colors px-3 py-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:border-[rgba(245,166,35,0.3)] hover:bg-[rgba(245,166,35,0.04)]"
              >
                <Plus className="w-3.5 h-3.5" />
                New conversation
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background: "rgba(245,166,35,0.1)", border: "1.5px solid rgba(245,166,35,0.3)" }}
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

        {!chatStarted ? (
          /* ── Structured form (first message) ── */
          <>
            <div
              className="rounded-[20px] p-6"
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

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-2xl text-sm text-[#FF3B30] font-medium"
                style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)" }}
              >
                {error}
              </motion.div>
            )}
          </>
        ) : (
          /* ── Chat view ── */
          <>
            <div className="space-y-4 mb-4">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "user" ? (
                    <div
                      className="max-w-[80%] px-4 py-3 text-sm text-white leading-relaxed"
                      style={{
                        background: "linear-gradient(135deg, #FFD700, #F5A623)",
                        borderRadius: "18px 18px 4px 18px",
                        boxShadow: "0 2px 12px rgba(245,166,35,0.3)",
                      }}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : (
                    <div
                      className="max-w-[90%] overflow-hidden"
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #F0F0F0",
                        borderLeft: "3px solid #F5A623",
                        borderRadius: "4px 18px 18px 18px",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div
                        className="flex items-center justify-between px-4 py-2.5"
                        style={{ borderBottom: "1px solid #F5F5F5" }}
                      >
                        <span className="text-xs font-bold text-[#F5A623]">{name}</span>
                        <button
                          onClick={() => handleCopy(msg.content, i)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#9B9B9B] hover:text-[#F5A623] transition-colors"
                        >
                          {copiedIdx === i ? (
                            <><Check className="w-3 h-3 text-[#34C759]" /> Copied!</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Copy</>
                          )}
                        </button>
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start"
                  >
                    <div
                      className="px-4 py-3 flex items-center gap-2"
                      style={{
                        background: "rgba(245,166,35,0.06)",
                        border: "1px solid rgba(245,166,35,0.2)",
                        borderRadius: "4px 18px 18px 18px",
                      }}
                    >
                      <Loader2 className="w-4 h-4 text-[#F5A623] animate-spin flex-shrink-0" />
                      <span className="text-sm font-semibold text-[#F5A623]">Thinking…</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={chatEndRef} />
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-3 p-3 rounded-2xl text-sm text-[#FF3B30] font-medium"
                style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)" }}
              >
                {error}
              </motion.div>
            )}

            {/* Follow-up input */}
            <div
              className="rounded-[20px] p-4"
              style={{ background: "#FFFFFF", border: "1px solid #F0F0F0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
            >
              <textarea
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleFollowUp();
                  }
                }}
                placeholder="Continue the conversation…"
                rows={3}
                disabled={loading}
                className="input-field resize-none mb-3"
                style={{ minHeight: 80 }}
              />
              <GoldButton
                onClick={handleFollowUp}
                loading={loading}
                disabled={!followUp.trim() || loading}
                size="lg"
                className="w-full"
              >
                {loading ? "Thinking…" : "Send"}
              </GoldButton>
              <p className="text-center text-[11px] text-[#C0C0C0] mt-2">
                Ctrl+Enter to send
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Clear confirmation modal ── */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(180,180,200,0.2)", backdropFilter: "blur(12px) saturate(150%)", WebkitBackdropFilter: "blur(12px) saturate(150%)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowClearConfirm(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 24, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.94, y: 12, filter: "blur(4px)" }}
              transition={{ duration: 0.28, ease: [0.175, 0.885, 0.32, 1.275] }}
              className="w-full max-w-sm p-6"
              style={{
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(60px) saturate(200%)",
                WebkitBackdropFilter: "blur(60px) saturate(200%)",
                border: "1px solid rgba(255,255,255,0.95)",
                borderTop: "1.5px solid rgba(255,255,255,1)",
                boxShadow: "0 32px 64px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,1)",
                borderRadius: 28,
              }}
            >
              <div className="text-center mb-5">
                <div
                  className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl"
                  style={{ background: "rgba(245,166,35,0.1)" }}
                >
                  ✨
                </div>
                <h4 className="font-bold text-lg text-[#1A1A1A] mb-1">Start new conversation?</h4>
                <p className="text-sm text-[#6B6B6B]">Current conversation will be cleared.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-2xl transition-all"
                  style={{
                    background: "rgba(120,120,130,0.12)",
                    border: "1px solid rgba(255,255,255,0.6)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
                    color: "#1A1A1A",
                  }}
                >
                  Cancel
                </button>
                <GoldButton className="flex-1" onClick={handleClear}>
                  Clear & Start
                </GoldButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
