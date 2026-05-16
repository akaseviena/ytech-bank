"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronLeft, Check, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";
import SuccessAnimation from "@/components/ui/SuccessAnimation";
import { useToast } from "@/components/ui/Toast";
import { getInitials, formatCurrency } from "@/lib/utils";
import { CATEGORY_INFO, type TransactionCategory, type Profile } from "@/types";

const QUICK_AMOUNTS = [10, 25, 50, 100, 200];

const stepVariants = {
  enter: { opacity: 0, x: 60 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

export default function TransferPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("other");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setCurrentUser(data as Profile);
    });
  }, []);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id,first_name,last_name,email,avatar_url,account_number,plan")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,account_number.ilike.%${q}%`)
      .neq("id", currentUser?.id ?? "")
      .limit(8);
    setResults((data ?? []) as Profile[]);
    setSearching(false);
  }, [currentUser?.id]);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(t);
  }, [query, searchUsers]);

  async function handleSend() {
    if (!recipient || !currentUser || !amount) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { showToast("error", "Invalid amount"); return; }
    if (num > (currentUser.balance ?? 0)) { showToast("error", "Insufficient funds"); return; }
    setSending(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("transfer_funds", {
      p_sender_id: currentUser.id,
      p_receiver_id: recipient.id,
      p_amount: num,
      p_description: description || null,
      p_category: category,
    });
    setSending(false);
    if (error || !data?.success) {
      showToast("error", "Transfer failed", data?.error ?? error?.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 3000);
  }

  if (success) {
    return (
      <PageTransition>
        <div className="p-6 max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
          <GlassCard className="p-8 w-full">
            <SuccessAnimation
              message="Transfer Sent!"
              subtitle={`€${parseFloat(amount).toFixed(2)} sent to ${recipient?.first_name} ${recipient?.last_name}`}
            />
          </GlassCard>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="font-bold text-2xl text-[#1A1A1A]">Send Money</h1>
          <p className="font-inter text-sm text-[#6B6B6B] mt-1">Transfer funds instantly</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {["Recipient", "Amount", "Confirm"].map((label, i) => {
            const s = i + 1;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${s <= step ? "flex-1" : "flex-1"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-sora font-bold flex-shrink-0 transition-all ${s < step ? "gold-gradient text-white" : s === step ? "border-2 border-[#F5A623] text-[#F5A623]" : "border border-[#D0D0D0] text-[#9B9B9B]"}`}>
                    {s < step ? <Check className="w-3.5 h-3.5" /> : s}
                  </div>
                  <span className={`text-xs font-inter hidden sm:block ${s === step ? "text-[#F5A623] font-semibold" : "text-[#9B9B9B]"}`}>{label}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-0.5 ${s < step ? "gold-gradient" : "bg-[#E5E5E5]"}`} />}
              </div>
            );
          })}
        </div>

        <GlassCard className="overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Step 1: Search recipient */}
            {step === 1 && (
              <motion.div key="s1" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }} className="p-6">
                <h2 className="font-sora font-semibold text-lg text-[#1A1A1A] mb-4">Who are you sending to?</h2>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, email, or account number…"
                    className="input-field pl-10"
                    autoFocus
                  />
                </div>
                {searching && <p className="text-sm text-[#9B9B9B] font-inter text-center py-4">Searching…</p>}
                {results.length > 0 && (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {results.map((u) => (
                      <motion.button
                        key={u.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setRecipient(u); setStep(2); }}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[rgba(245,166,35,0.06)] transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-white text-sm font-sora font-bold flex-shrink-0">
                          {u.avatar_url ? <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" /> : getInitials(u.first_name, u.last_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-inter font-semibold text-sm text-[#1A1A1A]">{u.first_name} {u.last_name}</p>
                          <p className="font-inter text-xs text-[#9B9B9B] truncate">{u.email}</p>
                        </div>
                        <span className="text-xs font-inter text-[#9B9B9B] font-mono">{u.account_number}</span>
                      </motion.button>
                    ))}
                  </div>
                )}
                {query.length >= 2 && !searching && results.length === 0 && (
                  <p className="text-sm text-[#9B9B9B] font-inter text-center py-8">No users found</p>
                )}
              </motion.div>
            )}

            {/* Step 2: Amount */}
            {step === 2 && (
              <motion.div key="s2" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }} className="p-6">
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-[#6B6B6B] mb-4 hover:text-[#1A1A1A] transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>

                {recipient && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[rgba(245,166,35,0.06)] border border-[rgba(245,166,35,0.2)] mb-6">
                    <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-white text-sm font-sora font-bold flex-shrink-0">
                      {getInitials(recipient.first_name, recipient.last_name)}
                    </div>
                    <div>
                      <p className="font-inter font-semibold text-sm text-[#1A1A1A]">{recipient.first_name} {recipient.last_name}</p>
                      <p className="font-inter text-xs text-[#9B9B9B]">{recipient.account_number}</p>
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className="relative inline-block">
                    <span className="font-sora text-5xl font-bold text-[#1A1A1A]">€</span>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0.00"
                      className="font-sora text-5xl font-bold text-[#1A1A1A] bg-transparent border-none outline-none w-40 text-center"
                      autoFocus
                    />
                  </div>
                  {currentUser && (
                    <p className="font-inter text-xs text-[#9B9B9B] mt-2">
                      Available: {formatCurrency(currentUser.balance)}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 justify-center mb-6 flex-wrap">
                  {QUICK_AMOUNTS.map((a) => (
                    <motion.button
                      key={a}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAmount(String(a))}
                      className={`px-4 py-2 rounded-xl text-sm font-inter font-semibold transition-all ${amount === String(a) ? "gold-gradient text-white" : "border border-[rgba(245,166,35,0.3)] text-[#F5A623] hover:bg-[rgba(245,166,35,0.06)]"}`}
                    >
                      €{a}
                    </motion.button>
                  ))}
                </div>

                <div className="space-y-3 mb-6">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="input-field"
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                    className="input-field"
                  >
                    {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                      <option key={key} value={key}>{info.emoji} {info.label}</option>
                    ))}
                  </select>
                </div>

                <GoldButton
                  onClick={() => { if (amount && parseFloat(amount) > 0) setStep(3); }}
                  size="lg"
                  className="w-full"
                  disabled={!amount || parseFloat(amount) <= 0}
                >
                  Continue
                </GoldButton>
              </motion.div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <motion.div key="s3" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }} className="p-6">
                <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-[#6B6B6B] mb-4 hover:text-[#1A1A1A] transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="font-sora font-semibold text-lg text-[#1A1A1A] mb-6">Confirm transfer</h2>

                <div className="space-y-3 mb-8">
                  {[
                    { label: "To", value: `${recipient?.first_name} ${recipient?.last_name}` },
                    { label: "Account", value: recipient?.account_number ?? "" },
                    { label: "Amount", value: formatCurrency(parseFloat(amount || "0")), bold: true, gold: true },
                    { label: "Category", value: `${CATEGORY_INFO[category].emoji} ${CATEGORY_INFO[category].label}` },
                    ...(description ? [{ label: "Note", value: description }] : []),
                  ].map(({ label, value, bold, gold }) => (
                    <div key={label} className="flex justify-between items-center p-3 rounded-2xl bg-[rgba(245,166,35,0.04)] border border-[rgba(245,166,35,0.1)]">
                      <span className="font-inter text-sm text-[#6B6B6B]">{label}</span>
                      <span className={`font-inter text-sm ${bold ? "font-bold text-lg" : "font-medium"} ${gold ? "gold-text" : "text-[#1A1A1A]"}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <GoldButton onClick={handleSend} loading={sending} size="lg" className="w-full">
                  <Send className="w-4 h-4" />
                  Send {formatCurrency(parseFloat(amount || "0"))}
                </GoldButton>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
