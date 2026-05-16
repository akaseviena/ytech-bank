"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, X, Bell, Lock, LogOut, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";
import { useToast } from "@/components/ui/Toast";
import { PLAN_INFO, type Plan, type Profile } from "@/types";

const plans = Object.values(PLAN_INFO);

const PLAN_PRICE: Record<Plan, number> = {
  basic:    0,
  standard: 4.90,
  travel:   9.90,
  metal:    14.90,
  ultimate: 34.90,
  business: 30.00,
};

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

export default function SettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [confirmingPlan, setConfirmingPlan] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [notifications, setNotifications] = useState({ transfers: true, promos: false, system: true });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data as Profile);
    })();
  }, []);

  function handleSelectPlan(plan: Plan) {
    if (!profile || plan === profile.plan) return;
    setPendingPlan(plan);
  }

  async function handleConfirmPlan() {
    if (!profile || !pendingPlan) return;
    setConfirmingPlan(true);

    const price = PLAN_PRICE[pendingPlan];
    const planName = PLAN_INFO[pendingPlan].name;

    const res = await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: pendingPlan }),
    });

    const result = await res.json();

    if (!res.ok) {
      const msg = result.error === "Insufficient balance"
        ? "Insufficient balance to subscribe to this plan"
        : result.error ?? "Failed to update plan";
      showToast("error", "Plan change failed", msg);
      setConfirmingPlan(false);
      return;
    }

    const newBalance = typeof result.newBalance === "number" ? result.newBalance : profile.balance - price;
    setProfile((prev) => prev ? { ...prev, plan: pendingPlan, balance: newBalance } : prev);
    setPendingPlan(null);
    setConfirmingPlan(false);
    showToast("success", `Successfully switched to ${planName} plan!`);
    router.refresh();
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const pendingPlanInfo = pendingPlan ? PLAN_INFO[pendingPlan] : null;
  const pendingPrice = pendingPlan ? PLAN_PRICE[pendingPlan] : 0;

  return (
    <PageTransition>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="font-bold text-2xl text-[#1A1A1A]">Settings</h1>
          <p className="text-sm text-[#6B6B6B] mt-1">Manage your account preferences</p>
        </div>

        <div className="space-y-6">
          {/* Plan selection */}
          <GlassCard className="p-6">
            <div className="mb-5">
              <h3 className="font-bold text-base text-[#1A1A1A]">Your Plan</h3>
              {profile && (
                <p className="text-xs text-[#9B9B9B] mt-1">
                  Currently on{" "}
                  <span className="text-[#F5A623] font-semibold">{PLAN_INFO[profile.plan].name}</span>
                  {" "}· Balance:{" "}
                  <span className="font-semibold text-[#1A1A1A]">€{profile.balance.toFixed(2)}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans.map((plan) => {
                const isCurrent = profile?.plan === plan.id;
                return (
                  <motion.button
                    key={plan.id}
                    whileTap={isCurrent ? {} : { scale: 0.98 }}
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent}
                    className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                      isCurrent
                        ? "border-[#F5A623] bg-[rgba(245,166,35,0.06)] shadow-[0_0_0_3px_rgba(245,166,35,0.12)] cursor-default"
                        : "border-[#F0F0F0] bg-white hover:border-[rgba(245,166,35,0.4)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.08)] cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {plan.emoji && <span className="text-lg">{plan.emoji}</span>}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#1A1A1A]">{plan.name}</span>
                          {isCurrent && (
                            <span style={{
                              background: "linear-gradient(135deg, #FFD700, #F5A623)",
                              color: "white",
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "4px 12px",
                              borderRadius: 20,
                              lineHeight: 1,
                            }}>
                              ✓ Current
                            </span>
                          )}
                        </div>
                        <div className={`text-xs font-semibold mt-0.5 ${isCurrent ? "text-[#F5A623]" : "text-[#6B6B6B]"}`}>
                          {plan.price}
                        </div>
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-[#6B6B6B]">
                          <Check className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isCurrent ? "text-[#F5A623]" : "text-[#9B9B9B]"}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </motion.button>
                );
              })}
            </div>
          </GlassCard>

          {/* Notifications */}
          <GlassCard className="p-6">
            <h3 className="font-bold text-base text-[#1A1A1A] mb-5 flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#F5A623]" /> Notifications
            </h3>
            <div className="space-y-3">
              {[
                { key: "transfers" as const, label: "Transfer notifications", desc: "Get notified on sends/receives" },
                { key: "promos" as const, label: "Promotions & offers", desc: "Special deals and plan upgrades" },
                { key: "system" as const, label: "System alerts", desc: "Security and account updates" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-2xl hover:bg-[rgba(245,166,35,0.04)] transition-colors">
                  <div>
                    <p className="font-medium text-sm text-[#1A1A1A]">{label}</p>
                    <p className="text-xs text-[#9B9B9B]">{desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${notifications[key] ? "gold-gradient" : "bg-[#E5E5E5]"}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${notifications[key] ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Security */}
          <GlassCard className="p-6">
            <h3 className="font-bold text-base text-[#1A1A1A] mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#F5A623]" /> Security
            </h3>
            <GoldButton variant="outline" onClick={() => showToast("info", "Password reset email sent", "Check your inbox.")}>
              Change password
            </GoldButton>
          </GlassCard>

          {/* Sign out */}
          <GlassCard className="p-6">
            <h3 className="font-bold text-base text-[#1A1A1A] mb-4 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-[#FF3B30]" /> Account
            </h3>
            <GoldButton variant="danger" onClick={() => setShowSignOutModal(true)}>
              Sign out
            </GoldButton>
          </GlassCard>
        </div>
      </div>

      {/* ── Plan confirmation modal ── */}
      <AnimatePresence>
        {pendingPlan && pendingPlanInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={LG_OVERLAY}
            onClick={(e) => { if (e.target === e.currentTarget) setPendingPlan(null); }}
          >
            <motion.div
              {...LG_ANIM}
              className="relative w-full max-w-sm p-6 overflow-hidden"
              style={LG_MODAL}
            >
              <GlassShine />

              <div className="relative flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl gold-gradient flex items-center justify-center shadow-[0_2px_8px_rgba(245,166,35,0.3)]">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-[#1A1A1A]">Confirm plan change</h4>
                  <p className="text-xs text-[#9B9B9B]">Review before switching</p>
                </div>
                <button
                  onClick={() => setPendingPlan(null)}
                  className="ml-auto text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div
                className="relative rounded-2xl p-4 mb-5"
                style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)" }}
              >
                <p className="text-sm font-semibold text-[#1A1A1A] mb-1">
                  You are switching to{" "}
                  <span className="text-[#F5A623]">{pendingPlanInfo.name}</span> plan
                </p>
                {pendingPrice > 0 ? (
                  <p className="text-sm text-[#6B6B6B]">
                    <span className="font-bold text-[#F5A623]">€{pendingPrice.toFixed(2)}</span>{" "}
                    will be deducted from your balance
                  </p>
                ) : (
                  <p className="text-sm text-[#6B6B6B]">You will be switched to the free plan</p>
                )}
                {profile && pendingPrice > 0 && (
                  <p className="text-xs text-[#9B9B9B] mt-2">
                    Current balance: €{profile.balance.toFixed(2)} → €{(profile.balance - pendingPrice).toFixed(2)}
                  </p>
                )}
              </div>

              <div className="relative flex gap-3">
                <button
                  onClick={() => setPendingPlan(null)}
                  disabled={confirmingPlan}
                  className="flex-1 py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                  style={LG_CANCEL}
                >
                  Cancel
                </button>
                <GoldButton
                  className="flex-1"
                  loading={confirmingPlan}
                  onClick={handleConfirmPlan}
                  style={LG_CONFIRM}
                >
                  Confirm
                </GoldButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sign out confirmation modal ── */}
      <AnimatePresence>
        {showSignOutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={LG_OVERLAY}
            onClick={(e) => { if (e.target === e.currentTarget) setShowSignOutModal(false); }}
          >
            <motion.div
              {...LG_ANIM}
              className="relative w-full max-w-sm p-6 overflow-hidden"
              style={LG_MODAL}
            >
              <GlassShine />

              <div className="relative flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-[rgba(255,59,48,0.1)] flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#FF3B30]" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-[#1A1A1A]">Sign out?</h4>
                  <p className="text-xs text-[#9B9B9B]">You&apos;ll be redirected to the login page.</p>
                </div>
                <button
                  onClick={() => setShowSignOutModal(false)}
                  className="ml-auto text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative flex gap-3">
                <button
                  onClick={() => setShowSignOutModal(false)}
                  className="flex-1 py-2.5 text-sm font-semibold transition-all"
                  style={LG_CANCEL}
                >
                  Cancel
                </button>
                <GoldButton variant="danger" className="flex-1" onClick={handleSignOut}>
                  Sign out
                </GoldButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
