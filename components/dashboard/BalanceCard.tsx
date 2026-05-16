"use client";

import { motion, useMotionValue, animate } from "framer-motion";
import { useEffect, useState } from "react";
import { Send, Plus } from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/types";

interface BalanceCardProps {
  profile: Profile;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const motionVal = useMotionValue(0);

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return controls.stop;
  }, [value, motionVal]);

  return (
    <span>
      €{display.toLocaleString("en-EU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  travel: "Travel ✈️",
  metal: "Metal",
  ultimate: "Ultimate 👑",
  business: "Business",
};

export default function BalanceCard({ profile }: BalanceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="gold-glass p-6 relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-[#6B6B6B] mb-1 font-medium">Total Balance</p>
            <h2 className="font-bold text-4xl text-[#1A1A1A]">
              <AnimatedNumber value={profile.balance} />
            </h2>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold gold-gradient text-white">
            {PLAN_LABELS[profile.plan] ?? profile.plan}
          </span>
        </div>

        <p className="text-xs text-[#9B9B9B] mb-5 font-medium">
          Account: {profile.account_number}
        </p>

        <div className="flex gap-3">
          <Link href="/transfer" className="flex-1">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 py-3 rounded-xl gold-gradient text-white font-semibold text-sm shadow-[0_2px_12px_rgba(245,166,35,0.3)] cursor-pointer transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_0_3px_rgba(245,166,35,0.15),_0_4px_20px_rgba(245,166,35,0.2)]"
            >
              <Send className="w-4 h-4" />
              Send Money
            </motion.div>
          </Link>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-[#F5A623] bg-white text-[#F5A623] font-semibold text-sm transition-all duration-200 hover:bg-[rgba(245,166,35,0.06)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.15),_0_4px_20px_rgba(245,166,35,0.2)]"
          >
            <Plus className="w-4 h-4" />
            Add Money
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
