"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Copy, Check, Loader2, Plus, Clock } from "lucide-react";
import Link from "next/link";
import GoldButton from "@/components/ui/GoldButton";
import PageTransition from "@/components/ui/PageTransition";
import { createClient } from "@/lib/supabase/client";
import type { AgentType } from "@/types";

type Message = { role: "user" | "assistant"; content: string };

const DAILY_LIMIT = 50;

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

function FormSkeleton() {
  return (
    <div
      className="rounded-[20px] p-6 space-y-4"
      style={{
        background: "#FFFFFF",
        border: "1px solid #F0F0F0",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
      aria-hidden="true"
    >
      <div className="h-4 w-1/3 bg-[#F0F0F0] rounded-xl animate-pulse" />
      <div className="h-28 bg-[#F0F0F0] rounded-2xl animate-pulse" />
      <div className="h-12 bg-[#F0F0F0] rounded-2xl animate-pulse" />
    </div>
  );
}

function LimitCard({ resetIn }: { resetIn: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4"
    >
      <div
        className="p-5 rounded-[24px]"
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "1.5px solid rgba(245,166,35,0.35)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)" }}
          >
            <Clock className="w-6 h-6 text-[#F5A623]" />
          </div>
          <div>
            <p className="font-bold text-[#1A1A1A] mb-1.5">
              You&apos;ve reached today&apos;s message limit (50/50) 🙏
            </p>
            <p className="text-sm text-[#6B6B6B] leading-relaxed">
              We&apos;re in early testing and keeping usage limits in place to make sure everyone gets a fair shot at trying Y-tech. Your limit resets at midnight UTC — thank you for helping us test!
            </p>
            <p className="text-sm text-[#6B6B6B] mt-2">
              In the meantime, feel free to explore other parts of the app.
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623" }}
          >
            <Clock className="w-3.5 h-3.5" />
            Resets in {resetIn}
          </div>
        </div>
      </div>
    </motion.div>
  );
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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dailyCount, setDailyCount] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [resetIn, setResetIn] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = useRef(createClient());
  const userIdRef = useRef("");

  const chatStarted = messages.length > 0;

  // Compute countdown string, update every minute
  useEffect(() => {
    function compute() {
      const midnight = new Date();
      midnight.setUTCHours(24, 0, 0, 0);
      const diff = midnight.getTime() - Date.now();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setResetIn(`${h}h ${m}m`);
    }
    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (chatStarted) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, chatStarted, limitReached]);

  // Load persisted conversation and daily count on mount
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.current.auth.getUser();
        if (!user) return;
        userIdRef.current = user.id;

        const today = new Date().toISOString().split("T")[0];
        const [convResult, usageResult] = await Promise.all([
          supabase.current
            .from("neurooffice_conversations")
            .select("messages")
            .eq("user_id", user.id)
            .eq("agent_type", agentType)
            .maybeSingle(),
          supabase.current
            .from("daily_usage")
            .select("message_count")
            .eq("user_id", user.id)
            .eq("usage_date", today)
            .maybeSingle(),
        ]);

        if (convResult.data?.messages && Array.isArray(convResult.data.messages) && (convResult.data.messages as unknown[]).length > 0) {
          const loaded = (convResult.data.messages as { role: string; content: string }[]).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
          setMessages(loaded);
        }

        const count = (usageResult.data?.message_count as number | null) ?? 0;
        setDailyCount(count);
        if (count >= DAILY_LIMIT) setLimitReached(true);
      } catch {
        // Gracefully fall through to empty state
      } finally {
        setHistoryLoading(false);
      }
    }
    init();
  }, [agentType]);

  async function persist(msgs: Message[]) {
    if (!userIdRef.current) return;
    try {
      await supabase.current.from("neurooffice_conversations").upsert(
        {
          user_id: userIdRef.current,
          agent_type: agentType,
          messages: msgs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,agent_type" },
      );
    } catch { /* non-critical */ }
  }

  async function sendToApi(payload: Record<string, unknown>, history: Message[]) {
    const res = await fetch("/api/neurooffice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentType, ...payload, conversationHistory: history }),
    });
    const data = await res.json() as { result?: string; error?: string; messagesUsed?: number; limitReached?: boolean };

    if (res.status === 429) {
      setLimitReached(true);
      setDailyCount(DAILY_LIMIT);
      throw new Error("LIMIT_REACHED");
    }
    if (!res.ok) throw new Error(data.error ?? "Generation failed");

    if (data.messagesUsed !== undefined) {
      setDailyCount(data.messagesUsed);
      if (data.messagesUsed >= DAILY_LIMIT) setLimitReached(true);
    }
    return data.result ?? "";
  }

  async function handleGenerate() {
    const payload = buildPayload();
    const displayText = (payload.input as string | undefined)?.trim() ?? "";
    if (!displayText || limitReached) return;

    setLoading(true);
    setError("");
    const userMsg: Message = { role: "user", content: displayText };
    setMessages([userMsg]);

    try {
      const result = await sendToApi(payload, []);
      const assistantMsg: Message = { role: "assistant", content: result };
      const newMessages = [userMsg, assistantMsg];
      setMessages(newMessages);
      await persist(newMessages);
    } catch (err) {
      if (err instanceof Error && err.message === "LIMIT_REACHED") {
        setMessages([]); // clear unprocessed user message
      } else {
        setMessages([]);
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp() {
    const text = followUp.trim();
    if (!text || loading || limitReached) return;
    setFollowUp("");
    setError("");

    const history = messages;
    const userMsg: Message = { role: "user", content: text };
    const messagesWithUser = [...history, userMsg];
    setMessages(messagesWithUser);
    setLoading(true);

    try {
      const result = await sendToApi({ input: text }, history);
      const finalMessages: Message[] = [...messagesWithUser, { role: "assistant" as const, content: result }];
      setMessages(finalMessages);
      await persist(finalMessages);
    } catch (err) {
      setMessages(history); // revert unprocessed user message
      if (!(err instanceof Error && err.message === "LIMIT_REACHED")) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(content: string, idx: number) {
    await navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  async function handleClear() {
    if (userIdRef.current) {
      try {
        await supabase.current
          .from("neurooffice_conversations")
          .delete()
          .eq("user_id", userIdRef.current)
          .eq("agent_type", agentType);
      } catch { /* ignore */ }
    }
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
            {!historyLoading && chatStarted && !limitReached && (
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

        {/* Loading skeleton */}
        {historyLoading ? (
          <FormSkeleton />
        ) : !chatStarted ? (
          /* Structured form (first message / after clear) */
          <>
            {limitReached ? (
              <LimitCard resetIn={resetIn} />
            ) : (
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
            )}

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
          /* Chat view */
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

              {limitReached && <LimitCard resetIn={resetIn} />}

              <div ref={chatEndRef} />
            </div>

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
                placeholder={limitReached ? "Daily limit reached — resets at midnight UTC" : "Continue the conversation…"}
                rows={3}
                disabled={loading || limitReached}
                className="input-field resize-none mb-3"
                style={{ minHeight: 80 }}
              />
              <GoldButton
                onClick={handleFollowUp}
                loading={loading}
                disabled={!followUp.trim() || loading || limitReached}
                size="lg"
                className="w-full"
              >
                {loading ? "Thinking…" : "Send"}
              </GoldButton>
              {dailyCount !== null && !limitReached && dailyCount > 0 && (
                <p className="text-center text-[11px] text-[#C0C0C0] mt-2">
                  {dailyCount}/{DAILY_LIMIT} messages today · Ctrl+Enter to send
                </p>
              )}
              {(!dailyCount || dailyCount === 0) && !limitReached && (
                <p className="text-center text-[11px] text-[#C0C0C0] mt-2">
                  Ctrl+Enter to send
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Clear confirmation modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: "rgba(180,180,200,0.2)",
              backdropFilter: "blur(12px) saturate(150%)",
              WebkitBackdropFilter: "blur(12px) saturate(150%)",
            }}
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
                <p className="text-sm text-[#6B6B6B]">Conversation history will be permanently deleted.</p>
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
