"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Snowflake, Eye, EyeOff, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateCardExpiry, getInitials } from "@/lib/utils";
import type { Profile } from "@/types";
import { useToast } from "@/components/ui/Toast";

interface VirtualCardProps {
  profile: Profile;
}

export default function VirtualCard({ profile }: VirtualCardProps) {
  const [showNumber, setShowNumber] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [frozen, setFrozen] = useState(profile.card_frozen);
  const [freezing, setFreezing] = useState(false);
  const { showToast } = useToast();

  async function toggleFreeze() {
    setFreezing(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ card_frozen: !frozen })
      .eq("id", profile.id);
    if (!error) {
      setFrozen(!frozen);
      showToast("info", frozen ? "Card unfrozen" : "Card frozen",
        frozen ? "Your card is now active." : "Your card has been frozen.");
    }
    setFreezing(false);
  }

  const cardDigits = profile.account_number.replace(/\D/g, "").padEnd(16, "0");
  const maskedNumber = showNumber
    ? `${cardDigits.slice(0, 4)} ${cardDigits.slice(4, 8)} ${cardDigits.slice(8, 12)} ${cardDigits.slice(12, 16)}`
    : `•••• •••• •••• ${cardDigits.slice(-4)}`;
  const expiry = generateCardExpiry(profile.created_at);

  return (
    <div className="space-y-4">
      {/* Card face */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-[20px] p-6"
        style={{
          background: "linear-gradient(135deg, #FFFDF5 0%, #FFF8E7 60%, #FFFDF5 100%)",
          border: "1px solid rgba(245,166,35,0.25)",
          boxShadow: "0 4px 20px rgba(245,166,35,0.1)",
          minHeight: 180,
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

        <div className="relative z-[1]">
          <div className="flex justify-between items-start mb-6">
            <img src="/logo.PNG" alt="" width={28} height={28} style={{ objectFit: "contain", opacity: 0.7 }} />
            <span className="text-[10px] font-bold text-[#9B9B9B] tracking-widest uppercase">Virtual Debit</span>
          </div>

          <p className="font-bold text-lg tracking-widest text-[#1A1A1A] mb-4">
            {maskedNumber}
          </p>

          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-[#ADADAD] uppercase tracking-wider mb-0.5 font-medium">Cardholder</p>
              <p className="font-bold text-sm text-[#1A1A1A]">
                {profile.first_name} {profile.last_name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#ADADAD] uppercase tracking-wider mb-0.5 font-medium">Expires</p>
              <p className="font-bold text-sm text-[#1A1A1A]">{expiry}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Freeze", icon: Snowflake, onClick: toggleFreeze, active: frozen, loading: freezing },
          { label: showCvv ? "Hide CVV" : "Show CVV", icon: Eye, onClick: () => setShowCvv(!showCvv) },
          { label: "Apple Pay", icon: Smartphone, onClick: () => {} },
          { label: showNumber ? "Hide" : "Reveal", icon: showNumber ? EyeOff : Eye, onClick: () => setShowNumber(!showNumber) },
        ].map(({ label, icon: Icon, onClick, active, loading }) => (
          <motion.button
            key={label}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            disabled={loading}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
              active
                ? "border-blue-300 bg-blue-50 text-blue-500"
                : "border-[#F0F0F0] bg-white text-[#6B6B6B] hover:border-[rgba(245,166,35,0.6)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.15),_0_4px_20px_rgba(245,166,35,0.2)] hover:text-[#F5A623]"
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
          { label: "Daily Limit", value: "€1,000" },
          { label: "CVV", value: showCvv ? "123" : "•••" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center text-sm">
            <span className="text-[#6B6B6B] font-medium">{label}</span>
            <span className={`font-semibold ${color ?? "text-[#1A1A1A]"}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
