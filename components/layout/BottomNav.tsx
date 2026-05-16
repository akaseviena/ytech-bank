"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, ArrowLeftRight, ClipboardList, Bot, User, Sparkles } from "lucide-react";
import NotificationDropdown from "@/components/ui/NotificationDropdown";
import type { Notification } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transfer", label: "Transfer", icon: ArrowLeftRight },
  { href: "/history", label: "History", icon: ClipboardList },
  { href: "/ai-assistant", label: "AI", icon: Bot },
  { href: "/neurooffice", label: "Office", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
];

interface BottomNavProps {
  notifications: Notification[];
  userId: string;
}

export default function BottomNav({ notifications, userId }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: "#FFFFFF",
        borderTop: "1px solid #F0F0F0",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} className="flex-1">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center gap-1 py-1"
              >
                <div
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    active
                      ? "gold-gradient text-white shadow-[0_2px_8px_rgba(245,166,35,0.3)]"
                      : "text-[#9B9B9B]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-semibold ${
                    active ? "text-[#F5A623]" : "text-[#9B9B9B]"
                  }`}
                >
                  {label}
                </span>
              </motion.div>
            </Link>
          );
        })}

        {/* Notification bell */}
        <div className="flex-1 flex justify-center">
          <NotificationDropdown
            notifications={notifications}
            userId={userId}
            placement="bottom-nav"
          />
        </div>
      </div>
    </nav>
  );
}
