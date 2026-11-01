"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Snowflake, Eye, EyeOff, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, CardInfo } from "@/types";
import { useToast } from "@/components/ui/Toast";

interface VirtualCardProps {
  profile: Profile;
  /** from card_get(); null if the person has no card yet */
  card: CardInfo | null;
}

const CARD_STYLES = {
  yellow: {
    background: "linear-gradient(135deg, #FFDC46 0%, #F7CB08 48%, #EFC000 100%)",
    border: "1px solid rgba(58,46,0,0.12)",
    boxShadow: "0 4px 20px rgba(245,200,0,0.35)",
    text: "#3A2E00",
    textMuted: "rgba(58,46,0,0.65)",
  },
  blue: {
    background: "linear-gradient(135deg, #79D6FF 0%, #28A8EF 52%, #0E85CE 100%)",
    border: "1px solid rgba(255,255,255,0.25)",
    boxShadow: "0 4px 20px rgba(14,133,206,0.35)",
    text: "#FFFFFF",
    textMuted: "rgba(255,255,255,0.75)",
  },
} as const;

export default function VirtualCard({ profile, card: initialCard }: VirtualCardProps) {
  const router = useRouter();
  const [showNumber, setShowNumber] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [card, setCard] = useState<CardInfo | null>(initialCard);
  const frozen = card?.status === "frozen";
  const [freezing, setFreezing] = useState(false);

  // The full number and the CVC are never part of this page, not even in what the
  // server renders: the page holds the last four digits, the expiry and the name.
  // The rest comes from the database function card_reveal when the person asks,
  // is kept only while it is shown, and is dropped again when hidden or after 30s.
  const [secret, setSecret] = useState<{ number: string; cvc: string } | null>(null);
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    if (!secret) return;
    const t = setTimeout(() => { setSecret(null); setShowNumber(false); setShowCvv(false); }, 30_000);
    return () => clearTimeout(t);
  }, [secret]);
  const [cardColor, setCardColor] = useState<"yellow" | "blue">(profile.card_color ?? "yellow");
  const [savingColor, setSavingColor] = useState(false);
  const { showToast } = useToast();
  const style = CARD_STYLES[cardColor];

  async function changeCardColor(next: "yellow" | "blue") {
    if (next === cardColor || savingColor) return;
    const prev = cardColor;
    setCardColor(next); // optimistic
    setSavingColor(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ card_color: next })
      .eq("id", profile.id)
      .select("card_color")
      .single();

    setSavingColor(false);

    if (error || !data) {
      setCardColor(prev); // revert the optimistic flip
      console.error("[VirtualCard] card color change failed:", error);
      showToast("error", "Couldn't update card color", error?.message ?? "Please try again.");
      return;
    }

    setCardColor(data.card_color as "yellow" | "blue");
    // Invalidate the Router Cache for this route — without this, navigating
    // back to /dashboard (a nav-link click, not a hard reload) can serve the
    // RSC payload cached from before this write and show the stale color.
    router.refresh();
  }

  async function toggleFreeze() {
    if (freezing) return;
    if (!card) {
      showToast("error", "No card yet", "Your card isn't ready yet. Please try again later.");
      return;
    }
    const previous = card;
    const next = card.status !== "frozen";

    // Optimistic — flip now, revert below if the write doesn't land.
    setCard({ ...card, status: next ? "frozen" : "active" });
    setFreezing(true);

    // Freezing is a database function: it checks the card belongs to the signed-in
    // person and returns the card as it now stands. (Nothing writes cards directly.)
    const supabase = createClient();
    const { data, error } = await supabase.rpc("card_set_frozen", { p_card_id: card.card_id, p_frozen: next });

    setFreezing(false);

    if (error || !data) {
      setCard(previous); // revert the optimistic flip
      console.error("[VirtualCard] freeze toggle failed:", error);
      showToast(
        "error",
        next ? "Couldn't freeze card" : "Couldn't unfreeze card",
        error?.message ?? "Please try again.",
      );
      return;
    }

    // Trust the card the database returned, not our guess.
    setCard(data as CardInfo);
    // Without this, going away and back can show the dashboard as it was before this change.
    router.refresh();
    showToast("info", next ? "Card frozen" : "Card unfrozen",
      next ? "Your card has been frozen." : "Your card is now active.");
  }

  // What the card face shows is the person's real card, from card_get().
  const maskedNumber =
    showNumber && secret
      ? secret.number.replace(/(\d{4})(?=\d)/g, "$1 ")
      : `•••• •••• •••• ${card?.last4 ?? "••••"}`;
  const expiry = card
    ? `${String(card.expiry_month).padStart(2, "0")}/${String(card.expiry_year % 100).padStart(2, "0")}`
    : "--/--";
  const holder = card?.holder_name.trim() || `${profile.first_name} ${profile.last_name}`.trim();

  /** One presence token buys one card_reveal; both are database functions that check the person. */
  async function fetchSecret(): Promise<{ number: string; cvc: string } | null> {
    const supabase = createClient();
    const fail = (message?: string) => showToast("error", "Couldn't reveal card", message ?? "Please try again.");
    const t = await supabase.rpc("card_presence_token");
    // card_presence_token() returns the token as a bare string.
    const token = typeof t.data === "string" ? t.data : undefined;
    if (t.error || !token) { fail(t.error?.message); return null; }
    const r = await supabase.rpc("card_reveal", { p_card_id: card!.card_id, p_presence_token: token });
    if (r.error || !r.data) { fail(r.error?.message); return null; }
    return { number: r.data.number, cvc: r.data.cvc };
  }

  async function reveal(which: "number" | "cvv") {
    if (revealing) return;
    if (!card) {
      showToast("error", "No card yet", "Your card isn't ready yet. Please try again later.");
      return;
    }
    const shown = which === "number" ? showNumber : showCvv;
    const otherShown = which === "number" ? showCvv : showNumber;
    const setShown = which === "number" ? setShowNumber : setShowCvv;
    if (shown) {                       // hide it; drop the secret once nothing is showing
      setShown(false);
      if (!otherShown) setSecret(null);
      return;
    }
    let s = secret;
    if (!s) {
      setRevealing(true);
      s = await fetchSecret();
      setRevealing(false);
      if (!s) return;
      setSecret(s);
    }
    setShown(true);
  }

  return (
    <div className="space-y-4">
      {/* Card face */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-[20px] p-6 w-full"
        style={{
          background: style.background,
          border: style.border,
          boxShadow: style.boxShadow,
          aspectRatio: "1.586 / 1",
        }}
      >
        {/* Frozen overlay */}
        <AnimatePresence>
          {frozen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-[20px] flex items-center justify-center z-10"
              style={{ background: "rgba(219,234,254,0.75)", backdropFilter: "blur(4px)" }}
            >
              <div className="text-center">
                <Snowflake className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                <p className="font-bold text-blue-600 text-sm">Card Frozen</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative z-[1] h-full flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-sora font-extrabold tracking-wide" style={{ color: style.text }}>Y-TECH</span>
            <div
              className="w-9 h-7 rounded-md"
              style={{ background: "linear-gradient(135deg, #F3E5B0 0%, #D9C079 50%, #B89A4E 100%)", border: "1px solid rgba(0,0,0,0.08)" }}
            />
          </div>

          <p className="font-bold text-lg tracking-widest" style={{ color: style.text }}>
            {maskedNumber}
          </p>

          <div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5 font-medium" style={{ color: style.textMuted }}>Cardholder</p>
                <p className="font-bold text-sm" style={{ color: style.text }}>
                  {holder}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider mb-0.5 font-medium" style={{ color: style.textMuted }}>Expires</p>
                <p className="font-bold text-sm" style={{ color: style.text }}>{expiry}</p>
              </div>
            </div>

            <div className="flex justify-end mt-3">
              <span className="text-lg font-black italic tracking-tight" style={{ color: style.text }}>VISA</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Freeze", icon: Snowflake, onClick: toggleFreeze, active: frozen, loading: freezing },
          { label: showCvv ? "Hide CVV" : "Show CVV", icon: Eye, onClick: () => reveal("cvv"), loading: revealing },
          { label: "Apple Pay", icon: Smartphone, onClick: () => {} },
          { label: showNumber ? "Hide" : "Reveal", icon: showNumber ? EyeOff : Eye, onClick: () => reveal("number"), loading: revealing },
        ].map(({ label, icon: Icon, onClick, active, loading }) => (
          <motion.button
            key={label}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            disabled={loading}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
              active
                ? "border-blue-300 bg-blue-50 text-blue-500"
                : "border-[#F0F0F0] bg-white text-[#6B6B6B] hover:border-[rgba(245,200,0,0.6)] hover:shadow-[0_0_0_3px_rgba(245,200,0,0.15),_0_4px_20px_rgba(245,200,0,0.2)] hover:text-[#F5C800]"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px] font-semibold">{label}</span>
          </motion.button>
        ))}
      </div>

      {/* Card details */}
      <div className="rounded-[20px] p-4 space-y-2" style={{ border: "1px solid #F0F0F0", background: "#FFFFFF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <h4 className="font-bold text-sm text-[#1A1A1A] mb-3">Card Details</h4>
        {[
          { label: "Type", value: "Virtual Debit" },
          { label: "Status", value: frozen ? "● Frozen" : "● Active", color: frozen ? "text-blue-500" : "text-[#34C759]" },
          { label: "Daily Limit", value: "£1,000" },
          { label: "CVV", value: showCvv && secret ? secret.cvc : "•••" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center text-sm">
            <span className="text-[#6B6B6B] font-medium">{label}</span>
            <span className={`font-semibold ${color ?? "text-[#1A1A1A]"}`}>{value}</span>
          </div>
        ))}
        <div className="flex justify-between items-center text-sm pt-1">
          <span className="text-[#6B6B6B] font-medium">Card color</span>
          <div className="flex items-center gap-2">
            {(["yellow", "blue"] as const).map((c) => (
              <motion.button
                key={c}
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => changeCardColor(c)}
                disabled={savingColor}
                aria-label={`${c === "yellow" ? "Yellow" : "Blue"} card`}
                aria-pressed={cardColor === c}
                className="w-6 h-6 rounded-full transition-all duration-150 disabled:opacity-60"
                style={{
                  background: CARD_STYLES[c].background,
                  boxShadow: cardColor === c ? "0 0 0 2px #FFFFFF, 0 0 0 4px " + (c === "yellow" ? "#F5C800" : "#0E85CE") : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
