"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, ArrowLeftRight, ClipboardList,
  BarChart3, Bot, User, Settings, LogOut, Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getInitials } from "@/lib/utils";
import type { Profile, Notification } from "@/types";
import NotificationDropdown from "@/components/ui/NotificationDropdown";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transfer", label: "Transfer", icon: ArrowLeftRight },
  { href: "/history", label: "History", icon: ClipboardList },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/ai-assistant", label: "AI Assistant", icon: Bot },
  { href: "/neurooffice", label: "NeuroOffice", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  profile: Profile;
  notifications: Notification[];
}

export default function Sidebar({ profile, notifications }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className="hidden lg:flex flex-col h-screen w-60 fixed left-0 top-0 z-40"
      style={{
        background: "#FFFFFF",
        borderRight: "1px solid #F0F0F0",
      }}
    >
      {/* Logo */}
      <div className="p-5" style={{ borderBottom: "1px solid #F5F5F5" }}>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ border: "1.5px solid rgba(245,166,35,0.5)", background: "#FFFFFF" }}
          >
            <img src="/logo.png" alt="Y-tech Bank" width={24} height={24} style={{ objectFit: "contain" }} />
          </div>
          <span className="font-bold text-sm gold-text">Y-tech Bank</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}>
              <motion.div
                whileHover={active ? {} : { x: 2 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  active
                    ? "gold-gradient text-white shadow-[0_2px_12px_rgba(245,166,35,0.3)]"
                    : "text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[rgba(245,166,35,0.06)] hover:border-[rgba(245,166,35,0.3)] border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold text-sm">{label}</span>
                {label === "AI Assistant" && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full gold-gradient text-white font-bold">AI</span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 space-y-2" style={{ borderTop: "1px solid #F5F5F5" }}>
        {/* Notifications */}
        <NotificationDropdown
          notifications={notifications}
          userId={profile.id}
          placement="sidebar"
        />

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center flex-shrink-0 text-white text-xs font-bold overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              getInitials(profile.first_name, profile.last_name)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs text-[#1A1A1A] truncate">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-[11px] text-[#6B6B6B] truncate capitalize">{profile.plan}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-[#6B6B6B] hover:text-[#FF3B30] transition-colors p-1"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
