"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { formatPence, ledgerPence, poundsToPence } from "@/lib/money";
import { CATEGORY_INFO, type TransactionCategory, type Recipient, type CardInfo } from "@/types";

const QUICK_AMOUNTS = [10, 25, 50, 100, 200];

const stepVariants = {
  enter: { opacity: 0, x: 60 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

// post_transfer answers { ok: false, code } when it refuses.
const REFUSAL_TEXT: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Insufficient funds",
  INVALID_AMOUNT: "Invalid amount",
  SAME_ACCOUNT: "You cannot send money to yourself",
  CURRENCY_MISMATCH: "These accounts use different currencies",
  FORBIDDEN: "This transfer is not permitted",
  NO_SUCH_ACCOUNT: "This transfer is not permitted",
};

/** "Anna A." -> "AA" */
function initialsOf(displayName: string): string {
  const words = displayName.replace(/\./g, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase();
}

function RecipientRow({ u, onSelect }: { u: Recipient; onSelect: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[rgba(245,200,0,0.06)] transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-[#3A2E00] text-sm font-sora font-bold flex-shrink-0">
        {u.avatar_url ? <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" /> : initialsOf(u.display_name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-inter font-semibold text-sm text-[#1A1A1A]">{u.display_name}</p>
        <p className="font-inter text-xs text-[#9B9B9B] font-mono">{u.account_ref}</p>
      </div>
    </motion.button>
  );
}

export default function TransferPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentResults, setRecentResults] = useState<Recipient[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("other");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  // The signed-in person's ledger account: id to pay from, balance in pence.
  const [me, setMe] = useState<{ userId: string; accountId: string; balanceMinor: number } | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [showFrozenModal, setShowFrozenModal] = useState(false);
  const [unfreezing, setUnfreezing] = useState(false);

  // One idempotency key per transfer intent. A double click or a retry after a
  // dropped connection reuses it, so the ledger posts the transfer once; any
  // change to who / how much / what starts a new intent and a new key.
  // post_transfer namespaces the key per signed-in user itself, so no user id
  // is added here.
  const attemptKey = useRef<string>(crypto.randomUUID());
  useEffect(() => {
    attemptKey.current = crypto.randomUUID();
  }, [recipient?.account_id, amount, description, category]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [card, account] = await Promise.all([
        supabase.rpc("card_get"),
        supabase.from("account_balances").select("account_id,balance_minor").eq("owner_id", user.id).eq("kind", "main").maybeSingle(),
      ]);
      const cardInfo = (card.error ? null : card.data) as CardInfo | null;
      setFrozen(cardInfo?.status === "frozen");
      setCardId(cardInfo?.card_id ?? null);
      if (account.data) {
        setMe({ userId: user.id, accountId: account.data.account_id, balanceMinor: ledgerPence(account.data.balance_minor) });
      }
    });
  }, []);

  // Default recipient list, shown before the user types anything — people
  // already paid (most recent first), then everyone else alphabetically.
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("recent_recipients").then(({ data, error }) => {
      if (error) console.error("[transfer] recent_recipients failed:", error);
      setRecentResults((data ?? []) as Recipient[]);
      setLoadingRecent(false);
    });
  }, []);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); return; }
    setSearching(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("search_recipients", { q });
    if (error) console.error("[transfer] search_recipients failed:", error);
    setResults((data ?? []) as Recipient[]);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(t);
  }, [query, searchUsers]);

  /** Returns the amount in pence, or null if the transfer should not proceed. */
  function validateTransfer(): number | null {
    if (!recipient || !me || !amount) return null;
    const pence = poundsToPence(amount);
    if (pence === null || pence <= 0) { showToast("error", "Invalid amount"); return null; }
    if (pence > me.balanceMinor) { showToast("error", "Insufficient funds"); return null; }
    return pence;
  }

  async function handleSend() {
    const pence = validateTransfer();
    if (pence === null) return;
    // A frozen card stops card payments, not transfers between people, but the
    // product still asks the person to unfreeze first. This is an interface
    // prompt only: post_transfer does not know about the card (decided).
    if (frozen) { setShowFrozenModal(true); return; }
    await performTransfer(pence);
  }

  async function performTransfer(pence: number) {
    if (!recipient || !me) return;
    setSending(true);
    const supabase = createClient();
    // Called as the signed-in person (role authenticated): the database itself
    // checks that p_from is their account and refuses system accounts.
    const { data, error } = await supabase.rpc("post_transfer", {
      p_from: me.accountId,
      p_to: recipient.account_id,
      p_amount_minor: pence,
      p_description: description || null,
      p_category: category,
      p_rail: "internal",
      p_idempotency_key: attemptKey.current,
    });
    setSending(false);
    if (error || !data?.ok) {
      showToast("error", "Transfer failed", REFUSAL_TEXT[data?.code] ?? error?.message ?? "Please try again.");
      return;
    }
    setSuccess(true);
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 3000);
  }

  async function handleUnfreezeAndContinue() {
    if (!me || !cardId || unfreezing) return;
    setUnfreezing(true);
    const supabase = createClient();
    // card_set_frozen checks the card is the signed-in person's and returns it as it now is.
    const { data, error } = await supabase.rpc("card_set_frozen", { p_card_id: cardId, p_frozen: false });
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
    const pence = validateTransfer();
    if (pence !== null) await performTransfer(pence);
  }

  if (success) {
    return (
      <PageTransition>
        <div className="p-6 max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
          <GlassCard className="p-8 w-full">
            <SuccessAnimation
              message="Transfer Sent!"
              subtitle={`${formatPence(poundsToPence(amount) ?? 0)} sent to ${recipient?.display_name}`}
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
                    placeholder="Search by name or account reference…"
                    className="input-field pl-10"
                    autoFocus
                  />
                </div>
                {query.length === 0 && (
                  <>
                    {loadingRecent && <p className="text-sm text-[#9B9B9B] font-inter text-center py-4">Loading…</p>}
                    {!loadingRecent && recentResults.length > 0 && (
                      <div className="space-y-4 max-h-80 overflow-y-auto">
                        {/* Two sections so nobody wonders why strangers are listed. Only an explicit
                            false is filler; a row without the column (or true) is someone already paid. */}
                        {[
                          { title: "Recent", people: recentResults.filter((u) => u.is_recent !== false) },
                          { title: "Everyone else", people: recentResults.filter((u) => u.is_recent === false) },
                        ]
                          .filter((section) => section.people.length > 0)
                          .map((section) => (
                            <div key={section.title}>
                              <p className="text-xs font-inter font-semibold text-[#9B9B9B] uppercase tracking-wider mb-2">{section.title}</p>
                              <div className="space-y-2">
                                {section.people.map((u) => (
                                  <RecipientRow key={u.account_id} u={u} onSelect={() => { setRecipient(u); setStep(2); }} />
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                    {!loadingRecent && recentResults.length === 0 && (
                      <p className="text-sm text-[#9B9B9B] font-inter text-center py-8">Find someone by name or account reference</p>
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
                          <RecipientRow key={u.account_id} u={u} onSelect={() => { setRecipient(u); setStep(2); }} />
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
                      {initialsOf(recipient.display_name)}
                    </div>
                    <div>
                      <p className="font-inter font-semibold text-sm text-[#1A1A1A]">{recipient.display_name}</p>
                      <p className="font-inter text-xs text-[#9B9B9B]">{recipient.account_ref}</p>
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
                  {me && (
                    <p className="font-inter text-xs text-[#9B9B9B] mt-2">
                      Available: {formatPence(me.balanceMinor)}
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
                  onClick={() => { if ((poundsToPence(amount) ?? 0) > 0) setStep(3); }}
                  size="lg"
                  className="w-full"
                  disabled={!((poundsToPence(amount) ?? 0) > 0)}
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
                    { label: "To", value: recipient?.display_name ?? "" },
                    { label: "Account", value: recipient?.account_ref ?? "" },
                    { label: "Amount", value: formatPence(poundsToPence(amount) ?? 0), bold: true, gold: true },
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
                  Send {formatPence(poundsToPence(amount) ?? 0)}
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
