"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useDailyUsage, DAILY_LIMIT } from "@/contexts/DailyUsageContext";

interface Props {
  variant?: "sidebar" | "mobile-fixed";
}

export default function UsageBadge({ variant = "sidebar" }: Props) {
  const { dailyCount, limitReached } = useDailyUsage();

  if (dailyCount === null) return null; // still loading

  const pct = dailyCount / DAILY_LIMIT;

  let textColor = "#6B6B6B"; // 0-79%: neutral gray
  let borderColor = "rgba(255,255,255,0.9)";
  let extraShadow = "";

  if (limitReached || pct >= 1) {
    textColor = "#FF3B30"; // 100%: red
    borderColor = "rgba(255,59,48,0.25)";
    extraShadow = ", 0 0 12px rgba(255,59,48,0.3)";
  } else if (pct >= 0.8) {
    textColor = "#F5A623"; // 80-99%: gold warning
    borderColor = "rgba(245,166,35,0.3)";
  }

  const isMobile = variant === "mobile-fixed";

  return (
    <Link
      href="/ai-assistant"
      title={`AI messages used today: ${dailyCount}/${DAILY_LIMIT}`}
      className={isMobile ? "fixed top-3 right-3 z-50 lg:hidden" : "block"}
    >
      <div
        className="flex items-center gap-1.5"
        style={{
          background: "rgba(255,255,255,0.5)",
          backdropFilter: "blur(20px) saturate(200%)",
          WebkitBackdropFilter: "blur(20px) saturate(200%)",
          border: `1px solid ${borderColor}`,
          borderRadius: 20,
          padding: isMobile ? "4px 10px" : "6px 14px",
          boxShadow: `0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)${extraShadow}`,
        }}
      >
        <Sparkles
          className="flex-shrink-0"
          style={{
            color: textColor,
            width: isMobile ? 12 : 14,
            height: isMobile ? 12 : 14,
          }}
        />
        <span
          className="font-semibold whitespace-nowrap"
          style={{ color: textColor, fontSize: isMobile ? 12 : 13 }}
        >
          {dailyCount}/{DAILY_LIMIT}
        </span>
      </div>
    </Link>
  );
}
