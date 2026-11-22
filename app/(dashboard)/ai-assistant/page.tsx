"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Plus, Trash2, X, Clock, History } from "lucide-react";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";
import {
  deleteConversation,
  listConversations,
  openConversation,
  openLatestConversation,
  startConversation,
  type ConversationListItem,
} from "@/lib/web-conversation";
import { dayBreaks, dayLabel } from "@/lib/clock";
import { createClient } from "@/lib/supabase/client";
import { useDailyUsage, DAILY_LIMIT } from "@/contexts/DailyUsageContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

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
          className="w-2 h-2 rounded-full bg-[#F5C800]"
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
          border: "1.5px solid rgba(245,200,0,0.35)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(245,200,0,0.1)", border: "1px solid rgba(245,200,0,0.25)" }}
          >
            <Clock className="w-6 h-6 text-[#F5C800]" />
          </div>
          <div>
            <p className="font-bold text-[#1A1A1A] mb-1.5">
              You&apos;ve reached today&apos;s message limit ({DAILY_LIMIT}/{DAILY_LIMIT}) 🙏
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
            style={{ background: "rgba(245,200,0,0.1)", color: "#F5C800" }}
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
  const { limitReached, resetIn, reportUsed } = useDailyUsage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showList, setShowList] = useState(false);
  const [listItems, setListItems] = useState<ConversationListItem[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useRef(createClient());
  const userIdRef = useRef("");
  const convIdRef = useRef("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, limitReached]);

  // Load persisted conversation on mount
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.current.auth.getUser();
        if (!user) return;
        userIdRef.current = user.id;

        // the most recently updated conversation, wherever it was written (lib/web-conversation.ts); the
        // id this browser used to remember decided nothing useful and is forgotten
        try { localStorage.removeItem(`ai_conv_${user.id}`); } catch { /* not available */ }
        const opened = await openLatestConversation(supabase.current, user.id);
        if (opened.messages.length > 0) setMessages(opened.messages as Message[]);
        const id = opened.id;

        convIdRef.current = id;
      } catch {
        // Gracefully fall through to empty state
      } finally {
        setHistoryLoading(false);
      }
    }
    init();
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || loading || limitReached) return;

    const userMsg: Message = { role: "user", content: text, timestamp: new Date().toISOString() };
    const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // the server saves the conversation (it is shared with the app); the browser only shows it
        body: JSON.stringify({ message: text, conversationId: convIdRef.current || undefined, conversationHistory }),
      });

      if (res.status === 429) {
        reportUsed(DAILY_LIMIT);
        setMessages(newMessages); // keep the user message visible
        return;
      }

      const data = await res.json() as { reply?: string; error?: string; messagesUsed?: number };
      if (data.messagesUsed !== undefined) reportUsed(data.messagesUsed);

      if (data.reply) {
        const assistantMsg: Message = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };
        const finalMessages = [...newMessages, assistantMsg];
        setMessages(finalMessages);
      }
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false);
    }
  }

  // "New" is one more conversation: the one on screen stays where it is, saved
  async function handleNew() {
    if (userIdRef.current) convIdRef.current = await startConversation(supabase.current, userIdRef.current);
    setMessages([]);
    setInput("");
  }

  function closeDelete() {
    setShowDeleteConfirm(false);
    setDeleteError("");
  }

  // "Delete this conversation": its own button and its own confirmation. Not part of "New".
  // When it is gone the person lands on their newest remaining conversation, as on a reload.
  async function handleDelete() {
    if (!userIdRef.current || !convIdRef.current) return closeDelete();
    const gone = await deleteConversation(supabase.current, userIdRef.current, convIdRef.current);
    if (!gone) {
      // not deleted, and the screen must not say it was
      setDeleteError("Could not delete this conversation. Please try again.");
      return;
    }
    const next = await openLatestConversation(supabase.current, userIdRef.current);
    convIdRef.current = next.id;
    setMessages(next.messages as Message[]);
    setInput("");
    closeDelete();
  }

  // The way back to a conversation you are not in: the newest 30, each as its date and its first line,
  // the app's included (the same rows). Read again every time it is opened.
  async function loadList() {
    if (!userIdRef.current) return;
    setListLoading(true);
    setListError("");
    const items = await listConversations(supabase.current, userIdRef.current);
    if (items) setListItems(items);
    else setListError("Could not load your conversations. Please try again.");
    setListLoading(false);
  }

  function openList() {
    setShowList(true);
    void loadList();
  }

  async function pickConversation(id: string) {
    if (id === convIdRef.current) {
      setShowList(false);
      return;
    }
    if (!userIdRef.current) return;
    const opened = await openConversation(supabase.current, userIdRef.current, id);
    if (!opened) {
      // deleted on another device since the list was read: say so, and show the list as it is now
      setListError("That conversation is no longer there.");
      void loadList();
      return;
    }
    convIdRef.current = opened.id;
    setMessages(opened.messages as Message[]);
    setInput("");
    setShowList(false);
  }

  const inputDisabled = loading || historyLoading || limitReached;
  // a heading above the first message of each London day, like the dates the assistant is told
  const breaks = dayBreaks(messages);

  return (
    <PageTransition>
      <div className="flex flex-col h-[calc(100vh-80px)] lg:h-screen">
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ background: "#FFFFFF", borderBottom: "1px solid #F0F0F0" }}
        >
          <div className="w-10 h-10 rounded-2xl gold-gradient flex items-center justify-center shadow-[0_2px_8px_rgba(245,200,0,0.3)] flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg text-[#1A1A1A]">AI Assistant</h1>
            <p className="text-xs text-[#6B6B6B]">Powered by Claude · Your personal finance advisor</p>
          </div>
          <AnimatePresence>
            {!historyLoading && (
              <motion.button
                key="history"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={openList}
                disabled={loading}
                title="Your conversations"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#9B9B9B] hover:text-[#F5C800] transition-colors px-3 py-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:border-[rgba(245,200,0,0.3)] hover:bg-[rgba(245,200,0,0.04)] flex-shrink-0 disabled:opacity-50"
              >
                <History className="w-3.5 h-3.5" />
                History
              </motion.button>
            )}
            {!historyLoading && messages.length > 0 && (
              <motion.button
                key="delete"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                title="Delete this conversation"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#9B9B9B] hover:text-[#D32F2F] transition-colors px-3 py-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:border-[rgba(211,47,47,0.3)] hover:bg-[rgba(211,47,47,0.04)] flex-shrink-0 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </motion.button>
            )}
            {!historyLoading && messages.length > 0 && !limitReached && (
              <motion.button
                key="new"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleNew}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#9B9B9B] hover:text-[#F5C800] transition-colors px-3 py-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:border-[rgba(245,200,0,0.3)] hover:bg-[rgba(245,200,0,0.04)] flex-shrink-0 disabled:opacity-50"
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
                        className="px-4 py-2 rounded-2xl border border-[rgba(245,200,0,0.2)] text-sm text-[#6B6B6B] hover:text-[#F5C800] hover:border-[rgba(245,200,0,0.5)] hover:shadow-[0_0_0_3px_rgba(245,200,0,0.08)] transition-all bg-white"
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
                  >
                    {breaks[i] && <div className="text-center text-xs font-semibold text-[#9B9B9B] py-2">{breaks[i]}</div>}
                    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div
                        className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mr-2 self-end"
                        style={{
                          background: "#FFFFFF",
                          border: "2px solid rgba(245,200,0,0.5)",
                          boxShadow: "0 0 8px rgba(245,200,0,0.3)",
                        }}
                      >
                        <img src="/logo.PNG" alt="" width={20} height={20} style={{ objectFit: "contain" }} />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-3xl px-4 py-3 text-sm font-inter leading-relaxed ${
                        msg.role === "user"
                          ? "gold-gradient text-[#3A2E00] rounded-br-md"
                          : "glass-card text-[#1A1A1A] rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
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
                      border: "2px solid rgba(245,200,0,0.5)",
                      boxShadow: "0 0 8px rgba(245,200,0,0.3)",
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
                className="flex-shrink-0 px-3 py-1.5 rounded-xl border border-[rgba(245,200,0,0.3)] text-xs text-[#6B6B6B] hover:text-[#F5C800] hover:border-[rgba(245,200,0,0.5)] transition-all bg-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input — pb-20 on mobile clears BottomNav (68px) + FeedbackButton (96–148px from bottom) */}
        <div
          className="px-4 pt-4 pb-20 lg:pb-4"
          style={{
            background: "#FFFFFF",
            borderTop: "1px solid #F0F0F0",
          }}
        >
          <div className="flex gap-3 max-w-3xl mx-auto">
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
              className="w-11 h-11 rounded-2xl gold-gradient text-[#3A2E00] flex items-center justify-center shadow-[0_2px_8px_rgba(245,200,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
      {/* Your conversations: date and first line, newest first */}
      <AnimatePresence>
        {showList && (
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
            onClick={(e) => { if (e.target === e.currentTarget) setShowList(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22 }}
              className="relative w-full max-w-md p-5 flex flex-col"
              style={{
                maxHeight: "80vh",
                background: "rgba(255,255,255,0.95)",
                border: "1px solid rgba(255,255,255,0.95)",
                boxShadow: "0 32px 64px rgba(0,0,0,0.12)",
                borderRadius: 24,
              }}
            >
              <button
                onClick={() => setShowList(false)}
                className="absolute top-4 right-4 text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <h4 className="font-bold text-lg text-[#1A1A1A] mb-3 pr-6">Your conversations</h4>
              {listError && <p className="text-sm text-[#D32F2F] mb-2">{listError}</p>}
              <div className="overflow-y-auto -mx-1 px-1">
                {listLoading && !listItems && <p className="text-sm text-[#6B6B6B] py-4 text-center">Loading…</p>}
                {listItems && listItems.length === 0 && <p className="text-sm text-[#6B6B6B] py-4 text-center">Nothing saved yet.</p>}
                {listItems?.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pickConversation(c.id)}
                    className="w-full text-left px-3 py-2.5 rounded-2xl hover:bg-[rgba(245,200,0,0.08)] transition-colors"
                    style={c.id === convIdRef.current ? { background: "rgba(245,200,0,0.12)" } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#9B9B9B]">{dayLabel(c.updatedAt) ?? ""}</span>
                      {c.id === convIdRef.current && <span className="text-[11px] font-semibold text-[#B8960A]">Current</span>}
                    </div>
                    <div className={`text-sm leading-snug ${c.empty ? "text-[#9B9B9B] italic" : "text-[#1A1A1A]"}`}>{c.title}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete conversation confirmation modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
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
            onClick={(e) => { if (e.target === e.currentTarget) closeDelete(); }}
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
                onClick={() => closeDelete()}
                className="absolute top-4 right-4 text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center mb-5">
                <div
                  className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl"
                  style={{ background: "rgba(245,200,0,0.1)" }}
                >
                  🗑️
                </div>
                <h4 className="font-bold text-lg text-[#1A1A1A] mb-1">Delete this conversation?</h4>
                <p className="text-sm text-[#6B6B6B]">It will be permanently deleted from your account. This cannot be undone.</p>
                {deleteError && <p className="text-sm text-[#D32F2F] mt-2">{deleteError}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => closeDelete()}
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
                <GoldButton className="flex-1" onClick={handleDelete}>
                  Delete
                </GoldButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
