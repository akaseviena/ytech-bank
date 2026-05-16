"use client";

import { motion } from "framer-motion";
import GoldButton from "./GoldButton";

interface EmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({
  emoji = "📭",
  title,
  description,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="text-6xl mb-4">{emoji}</div>
      <h3 className="font-semibold text-lg text-[#1A1A1A] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[#6B6B6B] max-w-xs mb-6">{description}</p>
      )}
      {ctaLabel && onCta && (
        <GoldButton onClick={onCta} size="sm">
          {ctaLabel}
        </GoldButton>
      )}
    </motion.div>
  );
}
