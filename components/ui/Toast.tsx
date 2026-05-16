"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-[#34C759]" />,
    error: <XCircle className="w-5 h-5 text-[#FF3B30]" />,
    info: <Info className="w-5 h-5 text-[#F5A623]" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative flex items-start gap-3 p-4 min-w-[280px] max-w-sm overflow-hidden"
      style={{
        background: "rgba(255, 255, 255, 0.5)",
        backdropFilter: "blur(40px) saturate(200%)",
        WebkitBackdropFilter: "blur(40px) saturate(200%)",
        border: "1px solid rgba(255,255,255,0.9)",
        borderTop: "1.5px solid rgba(255,255,255,1)",
        borderLeft: "1.5px solid rgba(255,255,255,0.9)",
        borderRadius: 20,
        boxShadow: "0 16px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,1)",
      }}
    >
      {/* Gold accent line */}
      <div aria-hidden className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 2 }}>
        <div style={{
          height: 2,
          width: "60%",
          background: "linear-gradient(90deg, transparent 0%, rgba(245,166,35,0.5) 30%, rgba(255,215,0,0.7) 50%, rgba(245,166,35,0.5) 70%, transparent 100%)",
          borderRadius: "0 0 2px 2px",
        }} />
      </div>
      {/* Top shine */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "55%",
          background: "linear-gradient(160deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0) 60%)",
          borderRadius: "20px 20px 0 0",
          zIndex: 1,
        }}
      />
      {/* Bottom reflection */}
      <div aria-hidden className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: "30%",
        background: "linear-gradient(to top, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 40%)",
        borderRadius: "0 0 20px 20px",
        zIndex: 1,
      }} />
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-[#1A1A1A]">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-[#6B6B6B] mt-0.5 font-medium">{toast.message}</p>
        )}
      </div>
      <button onClick={onClose} className="text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors relative">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
