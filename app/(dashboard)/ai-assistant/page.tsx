"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Plus, X, Clock } from "lucide-react";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";
import { createClient } from "@/lib/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const DAILY_LIMIT = 50;

const SUGGESTED = [
  "How am I spending this month?",
  "Should I upgrade my plan?",
  "How can I save more money?",
  "What's my biggest expense?",
  "Give me a savings tip",
];

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center p-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-[#F5A623]"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity, repeatDelay: 0.2 }}
        />
      ))}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-4 py-8 px-2" aria-hidden="true">
      <div className="flex justify-end">
        <div className="w-48 h-10 rounded-3xl bg-[#F0F0F0] animate-pulse" />
      </div>
      <div className="flex justify-start gap-2 items-end">
        <div className="w-8 h-8 rounded-2xl bg-[#F0F0F0] animate-pulse flex-shrink-0" />
        <div className="w-64 h-16 rounded-3xl bg-[#F0F0F0] animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-36 h-10 rounded-3xl bg-[#F0F0F0] animate-pulse" />
      </div>
      <div className="flex justify-start gap-2 items-end">
        <div className="w-8 h-8 rounded-2xl bg-[#F0F0F0] animate-pulse flex-shrink-0" />
        <div className="w-56 h-20 rounded-3xl bg-[#F0F0F0] animate-pulse" />
      </div>
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

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dailyCount, setDailyCount] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [resetIn, setResetIn] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useRef(createClient());
  const userIdRef = useRef("");
  const convIdRef = useRef("");

  // Compute countdown string
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

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, limitReached]);

  // Load persisted conversation and daily count on mount
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.current.auth.getUser();
        if (!user) return;
        userIdRef.current = user.id;

        const today = new Date().toISOString().split("T")[0];
        const [convResult, usageResult] = await Promise.all([
          (async () => {
            const storageKey = `ai_conv_${user.id}`;
            let id = localStorage.getItem(storageKey);
            if (id) {
              const { data } = await supabase.current
                .from("ai_conversations")
                .select("messages")
                .eq("id", id)
                .eq("user_id", user.id)
                .maybeSingle();
              if (data?.messages && (data.messages as Message[]).length > 0) {
                setMessages(data.messages as Message[]);
              } else if (!data) {
                id = crypto.randomUUID();
                localStorage.setItem(storageKey, id);
              }
            } else {
              id = crypto.randomUUID();
              localStorage.setItem(storageKey, id);
            }
            return id;
          })(),
          supabase.current
            .from("daily_usage")
            .select("message_count")
            .eq("user_id", user.id)
            .eq("usage_date", today)
            .maybeSingle(),
        ]);

        convIdRef.current = convResult as string;

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
  }, []);

  async function persist(msgs: Message[]) {
    if (!userIdRef.current || !convIdRef.current) return;
    try {
      await supabase.current.from("ai_conversations").upsert({
        id: convIdRef.current,
        user_id: userIdRef.current,
        messages: msgs,
        updated_at: new Date().toISOString(),
      });
    } catch { /* non-critical */ }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading || limitReached) return;

    const userMsg: Message = { role: "user", content: text, timestamp: new Date().toISOString() };
    const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationHistory }),
      });

      if (res.status === 429) {
        setLimitReached(true);
        setDailyCount(DAILY_LIMIT);
        setMessages(newMessages); // keep the user message visible
        return;
      }

      const data = await res.json() as { reply?: string; error?: string; messagesUsed?: number };
      if (data.messagesUsed !== undefined) {
        setDailyCount(data.messagesUsed);
        if (data.messagesUsed >= DAILY_LIMIT) setLimitReached(true);
      }
      if (data.reply) {
        const assistantMsg: Message = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };
        const finalMessages = [...newMessages, assistantMsg];
        setMessages(finalMessages);
        await persist(finalMessages);
      }
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    if (userIdRef.current && convIdRef.current) {
      try {
        await supabase.current
          .from("ai_conversations")
          .delete()
          .eq("id", convIdRef.current)
          .eq("user_id", userIdRef.current);
      } catch { /* ignore */ }
      const newId = crypto.randomUUID();
      localStorage.setItem(`ai_conv_${userIdRef.current}`, newId);
      convIdRef.current = newId;
    }
    setMessages([]);
    setInput("");
    setShowClearConfirm(false);
  }

  const inputDisabled = loading || historyLoading || limitReached;

  return (
    <PageTransition>
      <div className="flex flex-col h-[calc(100vh-0px)] lg:h-screen">
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ background: "#FFFFFF", borderBottom: "1px solid #F0F0F0" }}
        >
          <div className="w-10 h-10 rounded-2xl gold-gradient flex items-center justify-center shadow-[0_2px_8px_rgba(245,166,35,0.3)] flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg text-[#1A1A1A]">AI Assistant</h1>
            <p className="text-xs text-[#6B6B6B]">Powered by Claude · Your personal finance advisor</p>
          </div>
          <AnimatePresence>
            {!historyLoading && messages.length > 0 && !limitReached && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#9B9B9B] hover:text-[#F5A623] transition-colors px-3 py-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:border-[rgba(245,166,35,0.3)] hover:bg-[rgba(245,166,35,0.04)] flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {historyLoading ? (
            <HistorySkeleton />
          ) : (
            <>
              {messages.length === 0 && !limitReached && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <div className="text-5xl mb-4">🤖</div>
                  <h3 className="font-bold text-xl text-[#1A1A1A] mb-2">Hello! I&apos;m your AI advisor</h3>
                  <p className="text-sm text-[#6B6B6B] mb-8">Ask me anything about your finances.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTED.map((s) => (
                      <motion.button
                        key={s}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => sendMessage(s)}
                        className="px-4 py-2 rounded-2xl border border-[rgba(245,166,35,0.2)] text-sm text-[#6B6B6B] hover:text-[#F5A623] hover:border-[rgba(245,166,35,0.5)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.08)] transition-all bg-white"
                      >
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div
                        className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mr-2 self-end"
                        style={{
                          background: "#FFFFFF",
                          border: "2px solid rgba(245,166,35,0.5)",
                          boxShadow: "0 0 8px rgba(245,166,35,0.3)",
                        }}
                      >
                        <img src="/logo.PNG" alt="" width={20} height={20} style={{ objectFit: "contain" }} />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-3xl px-4 py-3 text-sm font-inter leading-relaxed ${
                        msg.role === "user"
                          ? "gold-gradient text-white rounded-br-md"
                          : "glass-card text-[#1A1A1A] rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div
                    className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mr-2 self-end"
                    style={{
                      background: "#FFFFFF",
                      border: "2px solid rgba(245,166,35,0.5)",
                      boxShadow: "0 0 8px rgba(245,166,35,0.3)",
                    }}
                  >
                    <img src="/logo.PNG" alt="" width={20} height={20} style={{ objectFit: "contain" }} />
                  </div>
                  <GlassCard className="rounded-bl-md">
                    <TypingIndicator />
                  </GlassCard>
                </motion.div>
              )}

              {limitReached && <LimitCard resetIn={resetIn} />}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Suggested chips */}
        {!historyLoading && messages.length > 0 && messages.length < 4 && !limitReached && (
          <div className="px-6 pb-3 flex gap-2 overflow-x-auto">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl border border-[rgba(245,166,35,0.3)] text-xs text-[#6B6B6B] hover:text-[#F5A623] hover:border-[rgba(245,166,35,0.5)] transition-all bg-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div
          className="px-4 py-4"
          style={{
            background: "#FFFFFF",
            borderTop: "1px solid #F0F0F0",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex flex-col gap-1.5 max-w-3xl mx-auto">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                placeholder={limitReached ? "Daily limit reached — resets at midnight UTC" : "Ask about your finances…"}
                className="input-field flex-1"
                disabled={inputDisabled}
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || inputDisabled}
                className="w-11 h-11 rounded-2xl gold-gradient text-white flex items-center justify-center shadow-[0_2px_8px_rgba(245,166,35,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </motion.button>
            </div>
            {dailyCount !== null && !limitReached && dailyCount > 0 && (
              <p className="text-right text-[11px] text-[#C0C0C0] pr-14">
                {dailyCount}/{DAILY_LIMIT} messages today
              </p>
            )}
          </div>
        </div>
      </div>

      {/* New conversation confirmation modal */}
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
              <button
                onClick={() => setShowClearConfirm(false)}
                className="absolute top-4 right-4 text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
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
