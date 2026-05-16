"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Target, PiggyBank } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import GoldButton from "@/components/ui/GoldButton";
import type { SavingsGoal } from "@/types";
import { useToast } from "@/components/ui/Toast";

interface SavingsGoalsProps {
  goals: SavingsGoal[];
  userId: string;
  userBalance: number;
}

const LG_OVERLAY: React.CSSProperties = {
  background: "rgba(180, 180, 200, 0.2)",
  backdropFilter: "blur(12px) saturate(150%)",
  WebkitBackdropFilter: "blur(12px) saturate(150%)",
};

const LG_MODAL: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.45)",
  backdropFilter: "blur(60px) saturate(250%) brightness(115%) contrast(90%)",
  WebkitBackdropFilter: "blur(60px) saturate(250%) brightness(115%) contrast(90%)",
  border: "1px solid rgba(255, 255, 255, 0.95)",
  borderTop: "1.5px solid rgba(255, 255, 255, 1)",
  borderLeft: "1.5px solid rgba(255, 255, 255, 0.9)",
  boxShadow:
    "0 48px 96px rgba(0,0,0,0.15), 0 16px 48px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.06), inset 0 2px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(255,255,255,0.6), inset 1px 0 0 rgba(255,255,255,0.6)",
  borderRadius: 32,
};

const LG_CANCEL: React.CSSProperties = {
  background: "rgba(120,120,130,0.15)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
  borderRadius: 16,
  color: "#1A1A1A",
};

const LG_CONFIRM: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,220,0,0.95) 0%, rgba(245,166,35,0.95) 100%)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,220,100,0.7)",
  boxShadow: "0 8px 24px rgba(245,166,35,0.5), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(200,130,0,0.3)",
  borderRadius: 16,
};

const LG_ANIM = {
  initial: { opacity: 0, scale: 0.88, y: 30, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.94, y: 15, filter: "blur(4px)" },
  transition: { duration: 0.3, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] },
};

function GlassShine() {
  return (
    <>
      {/* Gold accent line */}
      <div aria-hidden className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 4 }}>
        <div style={{
          height: 2,
          width: "70%",
          background: "linear-gradient(90deg, transparent 0%, rgba(245,166,35,0.6) 30%, rgba(255,215,0,0.8) 50%, rgba(245,166,35,0.6) 70%, transparent 100%)",
          borderRadius: "0 0 2px 2px",
        }} />
      </div>
      {/* Top shine */}
      <div aria-hidden className="absolute top-0 left-0 right-0 pointer-events-none" style={{
        height: "55%",
        background: "linear-gradient(160deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0) 60%)",
        borderRadius: "32px 32px 0 0",
        zIndex: 3,
      }} />
      {/* Bottom reflection */}
      <div aria-hidden className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: "30%",
        background: "linear-gradient(to top, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 40%)",
        borderRadius: "0 0 32px 32px",
        zIndex: 3,
      }} />
    </>
  );
}

export default function SavingsGoals({ goals: initialGoals, userId, userBalance }: SavingsGoalsProps) {
  const [goals, setGoals] = useState<SavingsGoal[]>(initialGoals);
  const [balance, setBalance] = useState(userBalance);

  const [showNewModal, setShowNewModal] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [saving, setSaving] = useState(false);

  const [fundsGoal, setFundsGoal] = useState<SavingsGoal | null>(null);
  const [fundsAmount, setFundsAmount] = useState("");
  const [addingFunds, setAddingFunds] = useState(false);
  const [fundsError, setFundsError] = useState("");

  const router = useRouter();
  const { showToast } = useToast();

  async function handleAdd() {
    if (!name || !target) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("savings_goals")
      .insert({ user_id: userId, name, target_amount: parseFloat(target), emoji })
      .select()
      .single();
    if (!error && data) {
      showToast("success", "Goal created!", `${emoji} ${name} added.`);
      setGoals((prev) => [...prev, data as SavingsGoal]);
      setShowNewModal(false);
      setName(""); setTarget(""); setEmoji("🎯");
    }
    setSaving(false);
  }

  async function handleAddFunds() {
    if (!fundsGoal || !fundsAmount) return;
    const num = parseFloat(fundsAmount);
    if (isNaN(num) || num <= 0) { setFundsError("Enter a valid amount"); return; }
    if (num > balance) { setFundsError(`Insufficient balance (€${balance.toFixed(2)} available)`); return; }

    const remaining = fundsGoal.target_amount - fundsGoal.current_amount;
    if (num > remaining) { setFundsError(`Max you can add is €${remaining.toFixed(2)}`); return; }

    setAddingFunds(true);
    setFundsError("");
    const supabase = createClient();

    const [balRes, goalRes] = await Promise.all([
      supabase.from("profiles").update({ balance: balance - num }).eq("id", userId),
      supabase
        .from("savings_goals")
        .update({ current_amount: fundsGoal.current_amount + num })
        .eq("id", fundsGoal.id)
        .select()
        .single(),
    ]);

    if (balRes.error || goalRes.error) {
      setFundsError("Something went wrong. Please try again.");
      setAddingFunds(false);
      return;
    }

    const updatedGoal = goalRes.data as SavingsGoal;
    setGoals((prev) => prev.map((g) => (g.id === fundsGoal.id ? updatedGoal : g)));
    setBalance((b) => b - num);
    showToast("success", "Funds added!", `€${num.toFixed(2)} added to ${fundsGoal.name} ${fundsGoal.emoji}`);
    setFundsGoal(null);
    setFundsAmount("");
    setAddingFunds(false);
    router.refresh();
  }

  function openFundsModal(goal: SavingsGoal) {
    setFundsGoal(goal);
    setFundsAmount("");
    setFundsError("");
  }

  const emojis = ["🎯", "🏠", "🚗", "✈️", "💻", "👜", "💍", "🎓", "💰", "🌴"];

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base text-[#1A1A1A]">Savings Goals</h3>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNewModal(true)}
          className="w-8 h-8 rounded-xl gold-gradient text-white flex items-center justify-center shadow-[0_2px_8px_rgba(245,166,35,0.3)] hover:brightness-110 transition-all"
        >
          <Plus className="w-4 h-4" />
        </motion.button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8">
          <Target className="w-10 h-10 text-[#E0E0E0] mx-auto mb-3" />
          <p className="text-sm text-[#9B9B9B] font-medium">No savings goals yet</p>
          <GoldButton size="sm" className="mt-3" onClick={() => setShowNewModal(true)}>
            Add your first goal
          </GoldButton>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {goals.map((goal) => {
            const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
            const isComplete = progress >= 100;
            return (
              <div
                key={goal.id}
                className="flex-shrink-0 w-52 p-4 rounded-[16px] border border-[#F0F0F0] bg-white transition-all duration-200 hover:border-[rgba(245,166,35,0.5)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.1),_0_4px_16px_rgba(245,166,35,0.15)]"
              >
                <div className="text-2xl mb-2">{goal.emoji}</div>
                <p className="font-semibold text-sm text-[#1A1A1A] truncate mb-1">{goal.name}</p>
                <div className="h-1.5 bg-[#F5F5F5] rounded-full mb-1.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full gold-gradient rounded-full"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#9B9B9B] font-semibold mb-3">
                  <span>€{goal.current_amount.toFixed(0)}</span>
                  <span>€{goal.target_amount.toFixed(0)}</span>
                </div>
                {!isComplete ? (
                  <button
                    onClick={() => openFundsModal(goal)}
                    className="w-full text-[11px] font-bold text-[#F5A623] border border-[rgba(245,166,35,0.4)] rounded-lg py-1.5 hover:bg-[rgba(245,166,35,0.06)] hover:border-[#F5A623] transition-all"
                  >
                    + Add funds
                  </button>
                ) : (
                  <div className="w-full text-[11px] font-bold text-[#34C759] text-center py-1.5">
                    ✓ Goal reached!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Goal Modal ── */}
      <AnimatePresence>
        {showNewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={LG_OVERLAY}
            onClick={(e) => e.target === e.currentTarget && setShowNewModal(false)}
          >
            <motion.div
              {...LG_ANIM}
              className="relative w-full max-w-sm p-6 overflow-hidden"
              style={LG_MODAL}
            >
              <GlassShine />
              <div className="relative flex items-center justify-between mb-5">
                <h4 className="font-bold text-lg text-[#1A1A1A]">New Savings Goal</h4>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Pick emoji</label>
                  <div className="flex flex-wrap gap-2">
                    {emojis.map((e) => (
                      <button
                        key={e}
                        onClick={() => setEmoji(e)}
                        className={`text-xl p-1.5 rounded-xl transition-all duration-200 ${
                          emoji === e ? "bg-[rgba(245,166,35,0.1)] ring-2 ring-[#F5A623]" : "hover:bg-[rgba(0,0,0,0.06)]"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Goal name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New laptop" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Target amount (€)</label>
                  <input value={target} onChange={(e) => setTarget(e.target.value)} type="number" placeholder="1000" className="input-field" />
                </div>
                <GoldButton
                  onClick={handleAdd}
                  loading={saving}
                  size="lg"
                  className="w-full"
                  style={LG_CONFIRM}
                >
                  Create Goal
                </GoldButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Funds Modal ── */}
      <AnimatePresence>
        {fundsGoal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={LG_OVERLAY}
            onClick={(e) => e.target === e.currentTarget && setFundsGoal(null)}
          >
            <motion.div
              {...LG_ANIM}
              className="relative w-full max-w-sm p-6 overflow-hidden"
              style={LG_MODAL}
            >
              <GlassShine />
              <div className="relative flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-[#F5A623]" />
                  <h4 className="font-bold text-lg text-[#1A1A1A]">{fundsGoal.emoji} {fundsGoal.name}</h4>
                </div>
                <button onClick={() => setFundsGoal(null)} className="text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress summary */}
              <div
                className="relative rounded-2xl p-4 mb-5"
                style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)" }}
              >
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#6B6B6B] font-medium">Current</span>
                  <span className="font-bold text-[#1A1A1A]">€{fundsGoal.current_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-[#6B6B6B] font-medium">Target</span>
                  <span className="font-bold text-[#1A1A1A]">€{fundsGoal.target_amount.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-[#F0F0F0] rounded-full">
                  <div
                    className="h-full gold-gradient rounded-full transition-all"
                    style={{ width: `${Math.min((fundsGoal.current_amount / fundsGoal.target_amount) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-[#9B9B9B] mt-2 font-medium">
                  €{(fundsGoal.target_amount - fundsGoal.current_amount).toFixed(2)} remaining
                </p>
              </div>

              <div className="relative mb-5">
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Amount to add (€)</label>
                <input
                  value={fundsAmount}
                  onChange={(e) => { setFundsAmount(e.target.value); setFundsError(""); }}
                  type="number"
                  placeholder="0.00"
                  className={`input-field ${fundsError ? "error" : ""}`}
                  autoFocus
                />
                {fundsError && (
                  <p className="mt-1.5 text-xs text-[#FF3B30] font-medium">{fundsError}</p>
                )}
                <p className="mt-1.5 text-xs text-[#9B9B9B] font-medium">
                  Available balance: €{balance.toFixed(2)}
                </p>
              </div>

              <div className="relative flex gap-3">
                <button
                  onClick={() => setFundsGoal(null)}
                  className="flex-1 py-2.5 text-sm font-semibold transition-all"
                  style={LG_CANCEL}
                >
                  Cancel
                </button>
                <GoldButton
                  onClick={handleAddFunds}
                  loading={addingFunds}
                  className="flex-1"
                  disabled={!fundsAmount || parseFloat(fundsAmount) <= 0}
                  style={LG_CONFIRM}
                >
                  Add funds
                </GoldButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
