"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  gold?: boolean;
  hover?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function GlassCard({
  gold = false,
  hover = false,
  children,
  className,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(gold ? "gold-glass" : "glass-card", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
