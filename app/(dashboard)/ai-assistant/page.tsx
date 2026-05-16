"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";

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
          className="w-2 h-2 rounded-full bg-[#F5A623]"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity, repeatDelay: 0.2 }}
        />
      ))}
    </div>
  );
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text, timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history }),
    });

    const data = await res.json() as { reply?: string; error?: string };
    setLoading(false);

    if (data.reply) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply!, timestamp: new Date().toISOString() },
      ]);
    }
  }

  return (
    <PageTransition>
      <div className="flex flex-col h-[calc(100vh-0px)] lg:h-screen">
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ background: "#FFFFFF", borderBottom: "1px solid #F0F0F0" }}>
          <div className="w-10 h-10 rounded-2xl gold-gradient flex items-center justify-center shadow-[0_2px_8px_rgba(245,166,35,0.3)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-[#1A1A1A]">AI Assistant</h1>
            <p className="text-xs text-[#6B6B6B]">Powered by Claude · Your personal finance advisor</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
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
                  <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mr-2 self-end" style={{ background: "#FFFFFF", border: "2px solid rgba(245,166,35,0.5)", boxShadow: "0 0 8px rgba(245,166,35,0.3)" }}>
                    <img src="/logo.png" alt="" width={20} height={20} style={{ objectFit: "contain" }} />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-3xl px-4 py-3 text-sm font-inter leading-relaxed ${
                    msg.role === "user"
                      ? "gold-gradient text-white rounded-br-md"
                      : "glass-card text-[#1A1A1A] rounded-bl-md"
                  }`}
                  style={msg.role === "user" ? {} : {}}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mr-2 self-end" style={{ background: "#FFFFFF", border: "2px solid rgba(245,166,35,0.5)", boxShadow: "0 0 8px rgba(245,166,35,0.3)" }}>
                <img src="/logo.png" alt="" width={20} height={20} style={{ objectFit: "contain" }} />
              </div>
              <GlassCard className="rounded-bl-md">
                <TypingIndicator />
              </GlassCard>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested chips when there are messages */}
        {messages.length > 0 && messages.length < 4 && (
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
        <div className="px-4 py-4" style={{ background: "#FFFFFF", borderTop: "1px solid #F0F0F0", borderRadius: 0, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="flex gap-3 max-w-3xl mx-auto">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask about your finances…"
              className="input-field flex-1"
              disabled={loading}
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-2xl gold-gradient text-white flex items-center justify-center shadow-[0_2px_8px_rgba(245,166,35,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
