"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, X } from "lucide-react";

interface FeedbackButtonProps {
  userEmail?: string;
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
};

const LG_ANIM = {
  initial: { opacity: 0, scale: 0.9, y: 24, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.94, y: 16, filter: "blur(4px)" },
  transition: { duration: 0.28, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] },
};

function GlassShine() {
  return (
    <>
      {/* Gold accent line at the top */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none"
        style={{ zIndex: 4 }}
      >
        <div
          style={{
            height: 2,
            width: "60%",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(245,166,35,0.6) 30%, rgba(255,215,0,0.85) 50%, rgba(245,166,35,0.6) 70%, transparent 100%)",
            borderRadius: "0 0 2px 2px",
          }}
        />
      </div>
      {/* Top glass sheen */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "40%",
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.25) 40%, rgba(255,255,255,0) 70%)",
          borderRadius: "28px 28px 0 0",
          zIndex: 3,
        }}
      />
    </>
  );
}

export default function FeedbackButton({ userEmail }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const tallyUrl = `https://tally.so/embed/PdoAZV?${
    userEmail ? `email=${encodeURIComponent(userEmail)}&` : ""
  }alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`;

  function openModal() {
    setLoaded(false);
    setOpen(true);
  }

  return (
    <>
      {/* ── Floating action button ── */}
      {/*
        bottom-24 (96px) on mobile keeps the button above the ~72px bottom nav.
        lg:bottom-6 drops it to 24px on desktop where there's no bottom nav.
      */}
      <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50">
        <div className="relative flex items-center">
          {/* Tooltip — appears to the left of the button */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-full mr-3 pointer-events-none"
              >
                <div
                  className="whitespace-nowrap text-xs font-semibold text-[#1A1A1A] px-3 py-1.5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.1), 0 0 0 1px rgba(245,166,35,0.15)",
                  }}
                >
                  Send Feedback
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* The button itself */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            onClick={openModal}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            aria-label="Send Feedback"
            style={{
              width: 52,
              height: 52,
              background: "linear-gradient(135deg, #FFD700 0%, #F5A623 100%)",
              boxShadow: "0 4px 20px rgba(245,166,35,0.5), 0 1px 4px rgba(0,0,0,0.12)",
            }}
            className="rounded-full flex items-center justify-center transition-shadow hover:shadow-[0_6px_28px_rgba(245,166,35,0.65)]"
          >
            <MessageSquarePlus className="w-5 h-5 text-white" strokeWidth={2} />
          </motion.button>
        </div>
      </div>

      {/* ── Feedback modal ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={LG_OVERLAY}
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <motion.div
              {...LG_ANIM}
              className="relative w-[90vw] max-w-[600px] flex flex-col overflow-hidden rounded-[28px]"
              style={{ ...LG_MODAL, maxHeight: "85vh" }}
            >
              <GlassShine />

              {/* Header */}
              <div
                className="relative flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0"
                style={{ zIndex: 5 }}
              >
                <div>
                  <h3 className="font-bold text-lg text-[#1A1A1A]">Share Your Feedback</h3>
                  <div
                    style={{
                      height: 2,
                      width: 56,
                      marginTop: 5,
                      background: "linear-gradient(90deg, #FFD700, #F5A623)",
                      borderRadius: 1,
                    }}
                  />
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9B9B] hover:text-[#1A1A1A] hover:bg-[rgba(0,0,0,0.06)] transition-all flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable form area */}
              <div
                className="relative flex-1 overflow-y-auto px-2 pb-4"
                style={{ zIndex: 5, WebkitOverflowScrolling: "touch" } as React.CSSProperties}
              >
                {/* Spinner shown while iframe loads */}
                {!loaded && (
                  <div className="flex justify-center items-center py-16">
                    <div className="w-8 h-8 rounded-full border-2 border-[#F5A623] border-t-transparent animate-spin" />
                  </div>
                )}

                <iframe
                  src={tallyUrl}
                  width="100%"
                  height="600"
                  frameBorder={0}
                  title="Feedback Form"
                  onLoad={() => setLoaded(true)}
                  style={{
                    display: "block",
                    opacity: loaded ? 1 : 0,
                    transition: "opacity 0.4s ease",
                  }}
                />

                {loaded && (
                  <p className="text-center text-xs font-inter text-[#9B9B9B] px-4 pb-2 leading-snug">
                    Sent via Tally.{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener"
                      style={{ color: "#F5A623" }}
                    >
                      See our Privacy Policy.
                    </a>
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
