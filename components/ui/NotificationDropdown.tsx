"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types";

interface Props {
  notifications: Notification[];
  userId: string;
  placement?: "sidebar" | "bottom-nav";
}

const TYPE_COLORS: Record<NotificationType, string> = {
  transfer: "#F5A623",
  info: "#3B82F6",
  system: "#6B6B6B",
  promo: "#34C759",
};

const TYPE_BG: Record<NotificationType, string> = {
  transfer: "rgba(245,166,35,0.12)",
  info: "rgba(59,130,246,0.12)",
  system: "rgba(107,107,107,0.12)",
  promo: "rgba(52,199,89,0.12)",
};

const TYPE_EMOJI: Record<NotificationType, string> = {
  transfer: "💸",
  info: "ℹ️",
  system: "⚙️",
  promo: "🎁",
};

export default function NotificationDropdown({
  notifications: initial,
  userId,
  placement = "sidebar",
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>(initial);
  const containerRef = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  async function markOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  }

  const panelClass =
    placement === "sidebar"
      ? "left-full bottom-0 ml-3"
      : "bottom-full right-0 mb-3";

  const panelY = placement === "bottom-nav" ? 8 : -8;

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger ── */}
      {placement === "sidebar" ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[rgba(245,166,35,0.06)] border border-transparent hover:border-[rgba(245,166,35,0.3)] transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-[#6B6B6B]" />
            <span className="text-sm text-[#6B6B6B] font-medium">Notifications</span>
          </div>
          {unread > 0 && (
            <span className="w-5 h-5 rounded-full gold-gradient text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative flex flex-col items-center gap-1 py-1"
        >
          <div
            className={`p-2 rounded-xl transition-all duration-200 ${
              open
                ? "gold-gradient text-white shadow-[0_2px_8px_rgba(245,166,35,0.3)]"
                : "text-[#9B9B9B]"
            }`}
          >
            <Bell className="w-5 h-5" />
          </div>
          {unread > 0 && (
            <span
              className="absolute top-0 right-0 w-4 h-4 rounded-full gold-gradient text-white text-[9px] font-bold flex items-center justify-center"
              style={{ transform: "translate(25%, -10%)" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <span className={`text-[10px] font-semibold ${open ? "text-[#F5A623]" : "text-[#9B9B9B]"}`}>
            Alerts
          </span>
        </button>
      )}

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: panelY, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.94, y: panelY, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: [0.175, 0.885, 0.32, 1.275] }}
            className={`absolute ${panelClass} w-80 z-50 overflow-hidden`}
            style={{
              background: "rgba(255, 255, 255, 0.45)",
              backdropFilter: "blur(60px) saturate(250%) brightness(115%) contrast(90%)",
              WebkitBackdropFilter: "blur(60px) saturate(250%) brightness(115%) contrast(90%)",
              border: "1px solid rgba(255, 255, 255, 0.95)",
              borderTop: "1.5px solid rgba(255, 255, 255, 1)",
              borderLeft: "1.5px solid rgba(255, 255, 255, 0.9)",
              borderRadius: 20,
              boxShadow:
                "0 48px 96px rgba(0,0,0,0.15), 0 16px 48px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.06), inset 0 2px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(255,255,255,0.6), inset 1px 0 0 rgba(255,255,255,0.6)",
            }}
          >
            {/* Gold accent line */}
            <div aria-hidden className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 4 }}>
              <div style={{
                height: 2,
                width: "70%",
                background: "linear-gradient(90deg, transparent 0%, rgba(245,166,35,0.6) 30%, rgba(255,215,0,0.8) 50%, rgba(245,166,35,0.6) 70%, transparent 100%)",
                borderRadius: "0 0 2px 2px",
              }} />
            </div>
            {/* Top shine */}
            <div aria-hidden className="absolute top-0 left-0 right-0 pointer-events-none" style={{
              height: "45%",
              background: "linear-gradient(160deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0) 60%)",
              borderRadius: "20px 20px 0 0",
              zIndex: 3,
            }} />
            {/* Bottom reflection */}
            <div aria-hidden className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
              height: "25%",
              background: "linear-gradient(to top, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 40%)",
              borderRadius: "0 0 20px 20px",
              zIndex: 3,
            }} />

            {/* Header */}
            <div
              className="relative flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", zIndex: 2 }}
            >
              <span className="font-bold text-sm text-[#1A1A1A]">Notifications</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={markAll}
                    className="text-xs font-bold text-[#F5A623] hover:text-[#C8860A] transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto relative" style={{ maxHeight: 360, zIndex: 2 }}>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Bell className="w-8 h-8 text-[#E0E0E0]" />
                  <p className="text-sm text-[#9B9B9B] font-medium">No notifications yet</p>
                </div>
              ) : (
                <div className="py-1">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => markOne(n.id)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(245,166,35,0.05)]"
                    >
                      {/* Unread dot */}
                      <div className="flex-shrink-0 mt-1">
                        {!n.is_read ? (
                          <div className="w-2 h-2 rounded-full gold-gradient" />
                        ) : (
                          <div className="w-2 h-2" />
                        )}
                      </div>

                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: TYPE_BG[n.type] }}
                      >
                        {TYPE_EMOJI[n.type]}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs text-[#1A1A1A] truncate"
                          style={{ fontWeight: n.is_read ? 500 : 700 }}
                        >
                          {n.title}
                        </p>
                        <p className="text-xs text-[#6B6B6B] mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-[#9B9B9B] mt-1 font-semibold">
                          {formatRelativeTime(n.created_at)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
