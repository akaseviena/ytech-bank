"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Snowflake, X } from "lucide-react";
import GoldButton from "@/components/ui/GoldButton";

// Liquid Glass tokens — same values as the settings / savings-goal modals.
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
          background: "linear-gradient(90deg, transparent 0%, rgba(245,200,0,0.6) 30%, rgba(255,215,0,0.8) 50%, rgba(245,200,0,0.6) 70%, transparent 100%)",
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

interface FrozenCardModalProps {
  open: boolean;
  /** True while the unfreeze write is in flight. */
  unfreezing?: boolean;
  onCancel: () => void;
  onUnfreeze: () => void;
}

export default function FrozenCardModal({
  open,
  unfreezing = false,
  onCancel,
  onUnfreeze,
}: FrozenCardModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={LG_OVERLAY}
          onClick={(e) => { if (e.target === e.currentTarget && !unfreezing) onCancel(); }}
        >
          <motion.div
            {...LG_ANIM}
            role="dialog"
            aria-modal="true"
            aria-labelledby="frozen-card-title"
            className="relative w-full max-w-sm p-6 overflow-hidden"
            style={LG_MODAL}
          >
            <GlassShine />

            <div className="relative flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[rgba(59,130,246,0.1)] flex items-center justify-center">
                <Snowflake className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h4 id="frozen-card-title" className="font-bold text-lg text-[#1A1A1A]">
                  Your card is frozen 🔒
                </h4>
                <p className="text-xs text-[#9B9B9B]">Unfreeze it first to send money.</p>
              </div>
              <button
                onClick={onCancel}
                disabled={unfreezing}
                aria-label="Close"
                className="ml-auto text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex gap-3">
              <button
                onClick={onCancel}
                disabled={unfreezing}
                className="flex-1 py-2.5 text-sm font-semibold transition-all disabled:opacity-40"
                style={LG_CANCEL}
              >
                Cancel
              </button>
              <GoldButton className="flex-1" onClick={onUnfreeze} loading={unfreezing}>
                Unfreeze Card
              </GoldButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
