"use client";

import {
  createContext, useContext, useState, useEffect,
  useCallback, type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export const DAILY_LIMIT = 50;

interface DailyUsageContextType {
  dailyCount: number | null; // null while the initial DB fetch is in-flight
  limitReached: boolean;
  resetIn: string;           // "4h 12m" — live countdown to midnight UTC
  reportUsed: (count: number) => void; // call with messagesUsed from API response
}

const DailyUsageContext = createContext<DailyUsageContextType>({
  dailyCount: null,
  limitReached: false,
  resetIn: "",
  reportUsed: () => {},
});

export function useDailyUsage() {
  return useContext(DailyUsageContext);
}

export function DailyUsageProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [dailyCount, setDailyCount] = useState<number | null>(null);
  const [resetIn, setResetIn] = useState("");

  // Countdown string — recomputes every minute
  useEffect(() => {
    function compute() {
      const midnight = new Date();
      midnight.setUTCHours(24, 0, 0, 0);
      const diff = midnight.getTime() - Date.now();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setResetIn(`${h}h ${m}m`);
    }
    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, []);

  // Load today's real count from DB once on mount.
  // This is the single authoritative source — no per-page fetches needed.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("daily_usage")
      .select("message_count")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle()
      .then(
        ({ data }) => setDailyCount((data?.message_count as number | null) ?? 0),
        () => setDailyCount(0), // table might not exist yet — degrade gracefully
      );
  }, [userId]);

  // Called by AI pages after each successful (or limit-hit) API response.
  // The count comes straight from the server, so it's always accurate.
  const reportUsed = useCallback((count: number) => {
    setDailyCount(count);
  }, []);

  const limitReached = (dailyCount ?? 0) >= DAILY_LIMIT;

  return (
    <DailyUsageContext.Provider value={{ dailyCount, limitReached, resetIn, reportUsed }}>
      {children}
    </DailyUsageContext.Provider>
  );
}
