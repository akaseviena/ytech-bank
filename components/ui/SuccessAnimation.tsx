"use client";

import { motion } from "framer-motion";

interface SuccessAnimationProps {
  message?: string;
  subtitle?: string;
}

export default function SuccessAnimation({
  message = "Success!",
  subtitle,
}: SuccessAnimationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-[#34C759] flex items-center justify-center mb-6 shadow-lg"
      >
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-10 h-10"
          initial="hidden"
          animate="visible"
        >
          <motion.path
            d="M5 13l4 4L19 7"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: {
                pathLength: 1,
                opacity: 1,
                transition: { duration: 0.5, delay: 0.3, ease: "easeOut" },
              },
            }}
          />
        </motion.svg>
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="font-bold text-2xl text-[#1A1A1A] mb-2"
      >
        {message}
      </motion.h3>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm text-[#6B6B6B]"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}
