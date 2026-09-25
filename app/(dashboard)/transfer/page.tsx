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
import FrozenCardModal from "@/components/ui/FrozenCardModal";
import { useToast } from "@/components/ui/Toast";
import { getInitials, formatCurrency } from "@/lib/utils";
import { CATEGORY_INFO, type TransactionCategory, type Profile } from "@/types";

const QUICK_AMOUNTS = [10, 25, 50, 100, 200];

const stepVariants = {
  enter: { opacity: 0, x: 60 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

function RecipientRow({ u, onSelect }: { u: Profile; onSelect: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[rgba(245,200,0,0.06)] transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-[#3A2E00] text-sm font-sora font-bold flex-shrink-0">
        {u.avatar_url ? <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" /> : getInitials(u.first_name, u.last_name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-inter font-semibold text-sm text-[#1A1A1A]">{u.first_name} {u.last_name}</p>
        <p className="font-inter text-xs text-[#9B9B9B] font-mono">{u.account_number}</p>
      </div>
    </motion.button>
  );
}

export default function TransferPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentResults, setRecentResults] = useState<Profile[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("other");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [showFrozenModal, setShowFrozenModal] = useState(false);
  const [unfreezing, setUnfreezing] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("id,balance,first_name,last_name,account_number,avatar_url,plan,card_frozen").eq("id", user.id).single();
      setCurrentUser(data as Profile);
      setFrozen(Boolean(data?.card_frozen));
    });
  }, []);

  // Default recipient list, shown before the user types anything — people
  // already sent to (most recent first), then everyone else alphabetically.
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("recent_recipients").then(({ data, error }) => {
      if (error) console.error("[transfer] recent_recipients failed:", error);
      setRecentResults((data ?? []) as Profile[]);
      setLoadingRecent(false);
    });
  }, []);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); return; }
    setSearching(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("search_transfer_recipients", { q });
    if (error) console.error("[transfer] search_transfer_recipients failed:", error);
    setResults((data ?? []) as Profile[]);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(t);
  }, [query, searchUsers]);

  /** Returns the parsed amount, or null if the transfer shouldn't proceed. */
  function validateTransfer(): number | null {
    if (!recipient || !currentUser || !amount) return null;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { showToast("error", "Invalid amount"); return null; }
    if (num > (currentUser.balance ?? 0)) { showToast("error", "Insufficient funds"); return null; }
    return num;
  }

  async function handleSend() {
    const num = validateTransfer();
    if (num === null) return;
    // Frozen cards can't send money. transfer_funds() enforces this server-side
    // too — this check just saves a round-trip and gives a nicer prompt.
    if (frozen) { setShowFrozenModal(true); return; }
    await performTransfer(num);
  }

  async function performTransfer(num: number) {
    if (!recipient || !currentUser) return;
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
      // Server-side rejection — e.g. the card was frozen in another tab after
      // this page loaded. Resync local state and prompt instead of erroring out.
      if (data?.code === "card_frozen") {
        setFrozen(true);
        setShowFrozenModal(true);
        return;
      }
      showToast("error", "Transfer failed", data?.error ?? error?.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 3000);
  }

  async function handleUnfreezeAndContinue() {
    if (!currentUser || unfreezing) return;
    setUnfreezing(true);
    const supabase = createClient();
    // .select().single() so an RLS-filtered zero-row update surfaces as an
    // error rather than a silent no-op (see VirtualCard.toggleFreeze).
    const { data, error } = await supabase
      .from("profiles")
      .update({ card_frozen: false })
      .eq("id", currentUser.id)
      .select("card_frozen")
      .single();
    setUnfreezing(false);

    if (error || !data) {
      console.error("[transfer] unfreeze failed:", error);
      showToast("error", "Couldn't unfreeze card", error?.message ?? "Please try again.");
      return;
    }

    setFrozen(false);
    setShowFrozenModal(false);
    showToast("info", "Card unfrozen", "Your card is now active.");

    // Carry straight on with the transfer they were already trying to make.
    const num = validateTransfer();
    if (num !== null) await performTransfer(num);
  }

  if (success) {
    return (
      <PageTransition>
        <div className="p-6 max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
          <GlassCard className="p-8 w-full">
            <SuccessAnimation
              message="Transfer Sent!"
              subtitle={`£${parseFloat(amount).toFixed(2)} sent to ${recipient?.first_name} ${recipient?.last_name}`}
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
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-sora font-bold flex-shrink-0 transition-all ${s < step ? "gold-gradient text-[#3A2E00]" : s === step ? "border-2 border-[#F5C800] text-[#F5C800]" : "border border-[#D0D0D0] text-[#9B9B9B]"}`}>
                    {s < step ? <Check className="w-3.5 h-3.5" /> : s}
                  </div>
                  <span className={`text-xs font-inter hidden sm:block ${s === step ? "text-[#F5C800] font-semibold" : "text-[#9B9B9B]"}`}>{label}</span>
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
                {query.length === 0 && (
                  <>
                    <p className="text-xs font-inter font-semibold text-[#9B9B9B] uppercase tracking-wider mb-2">All recipients</p>
                    {loadingRecent && <p className="text-sm text-[#9B9B9B] font-inter text-center py-4">Loading…</p>}
                    {!loadingRecent && recentResults.length > 0 && (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {recentResults.map((u) => (
                          <RecipientRow key={u.id} u={u} onSelect={() => { setRecipient(u); setStep(2); }} />
                        ))}
                      </div>
                    )}
                    {!loadingRecent && recentResults.length === 0 && (
                      <p className="text-sm text-[#9B9B9B] font-inter text-center py-8">No recipients yet</p>
                    )}
                  </>
                )}

                {query.length > 0 && query.length < 3 && (
                  <p className="text-sm text-[#9B9B9B] font-inter text-center py-2">Type at least 3 characters to search</p>
                )}

                {query.length >= 3 && (
                  <>
                    {searching && <p className="text-sm text-[#9B9B9B] font-inter text-center py-4">Searching…</p>}
                    {results.length > 0 && (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {results.map((u) => (
                          <RecipientRow key={u.id} u={u} onSelect={() => { setRecipient(u); setStep(2); }} />
                        ))}
                      </div>
                    )}
                    {!searching && results.length === 0 && (
                      <p className="text-sm text-[#9B9B9B] font-inter text-center py-8">No users found</p>
                    )}
                  </>
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
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[rgba(245,200,0,0.06)] border border-[rgba(245,200,0,0.2)] mb-6">
                    <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-[#3A2E00] text-sm font-sora font-bold flex-shrink-0">
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
                    <span className="font-sora text-5xl font-bold text-[#1A1A1A]">£</span>
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
                      className={`px-4 py-2 rounded-xl text-sm font-inter font-semibold transition-all ${amount === String(a) ? "gold-gradient text-[#3A2E00]" : "border border-[rgba(245,200,0,0.3)] text-[#F5C800] hover:bg-[rgba(245,200,0,0.06)]"}`}
                    >
                      £{a}
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
                    <div key={label} className="flex justify-between items-center p-3 rounded-2xl bg-[rgba(245,200,0,0.04)] border border-[rgba(245,200,0,0.1)]">
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

      <FrozenCardModal
        open={showFrozenModal}
        unfreezing={unfreezing}
        onCancel={() => setShowFrozenModal(false)}
        onUnfreeze={handleUnfreezeAndContinue}
      />
    </PageTransition>
  );
}
