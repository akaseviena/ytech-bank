"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface GoldButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "gold" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export default function GoldButton({
  loading = false,
  variant = "gold",
  size = "md",
  children,
  className,
  disabled,
  ...props
}: GoldButtonProps) {
  const variants = {
    gold: "gold-gradient text-white hover:brightness-110 hover:shadow-gold-glow",
    outline:
      "bg-white border border-[#F5A623] text-[#F5A623] hover:bg-[rgba(245,166,35,0.06)] hover:shadow-gold-glow",
    ghost: "bg-transparent text-[#F5A623] hover:bg-[rgba(245,166,35,0.08)]",
    danger: "bg-[#FF3B30] text-white hover:bg-[#E0352A] hover:shadow-[0_0_0_3px_rgba(255,59,48,0.15)]",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm rounded-xl",
    md: "px-6 py-3 text-sm rounded-2xl",
    lg: "px-8 py-4 text-base rounded-2xl",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      disabled={disabled || loading}
      className={cn(
        "relative font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...(props as React.ComponentPropsWithRef<typeof motion.button>)}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </motion.button>
  );
}
