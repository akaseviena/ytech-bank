"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "#FFFFFF" }}
        >
          {/* Logo circle */}
          <motion.div
            animate={{
              boxShadow: [
                "0 0 20px rgba(245,166,35,0.3)",
                "0 0 60px rgba(245,166,35,0.9), 0 0 120px rgba(245,166,35,0.3)",
                "0 0 20px rgba(245,166,35,0.3)",
              ],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-full flex items-center justify-center mb-6"
            style={{
              width: 120,
              height: 120,
              border: "2px solid rgba(245,166,35,0.6)",
              background: "#FFFFFF",
            }}
          >
            <img
              src="/logo.PNG"
              alt="Y-tech Bank"
              width={80}
              height={80}
              style={{ objectFit: "contain", borderRadius: "50%" }}
            />
          </motion.div>

          {/* Bank name */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="font-bold text-2xl mb-2 gold-text"
          >
            Y-tech Bank
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-sm"
            style={{ color: "#6B6B6B" }}
          >
            Banking for the next generation
          </motion.p>

          {/* Progress bar */}
          <motion.div
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
            style={{ width: 200, height: 3, background: "rgba(245,166,35,0.15)", borderRadius: 99 }}
          >
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2.5, ease: "easeInOut" }}
              style={{
                height: "100%",
                background: "linear-gradient(to right, #FFD700, #F5A623, #C8860A)",
                borderRadius: 99,
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
