"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart
} from "recharts";
import { subDays, subMonths, subYears, format, startOfDay, eachDayOfInterval } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";
import { formatCurrency } from "@/lib/utils";
import { CATEGORY_INFO, type TransactionCategory, type Transaction } from "@/types";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Activity } from "lucide-react";

type Period = "week" | "month" | "3months" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  week: "Week",
  month: "Month",
  "3months": "3 Months",
  year: "Year",
};

const GOLD_PALETTE = ["#FFD700", "#F5A623", "#C8860A", "#E8B84B", "#A0710A", "#FDE68A", "#D97706", "#92400E", "#FBBF24"];

function getStartDate(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "week": return subDays(now, 7);
    case "month": return subMonths(now, 1);
    case "3months": return subMonths(now, 3);
    case "year": return subYears(now, 1);
  }
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
      setBalance(profile?.balance ?? 0);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("transactions")
        .select("*, sender:profiles!sender_id(id,first_name,last_name), receiver:profiles!receiver_id(id,first_name,last_name)")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .gte("created_at", getStartDate(period).toISOString())
        .order("created_at", { ascending: true });
      setTransactions((data ?? []) as Transaction[]);
      setLoading(false);
    })();
  }, [userId, period]);

  const sent = transactions.filter((t) => t.sender_id === userId);
  const received = transactions.filter((t) => t.sender_id !== userId);
  const totalSent = sent.reduce((s, t) => s + Number(t.amount), 0);
  const totalReceived = received.reduce((s, t) => s + Number(t.amount), 0);
  const netFlow = totalReceived - totalSent;

  // Category breakdown
  const categoryMap: Partial<Record<TransactionCategory, number>> = {};
  sent.forEach((t) => {
    const c = t.category as TransactionCategory;
    categoryMap[c] = (categoryMap[c] ?? 0) + Number(t.amount);
  });
  const categoryData = Object.entries(categoryMap)
    .map(([cat, value]) => ({
      name: CATEGORY_INFO[cat as TransactionCategory]?.label ?? cat,
      value: Number(value.toFixed(2)),
      emoji: CATEGORY_INFO[cat as TransactionCategory]?.emoji ?? "💳",
    }))
    .sort((a, b) => b.value - a.value);

  // Balance over time — work BACKWARDS from the real current balance.
  // For each day d, undo every transaction that happened AFTER that day:
  //   outgoing after d → add back (balance was higher before it left)
  //   incoming after d → subtract back (balance was lower before it arrived)
  const days = eachDayOfInterval({ start: getStartDate(period), end: new Date() });
  const balanceData = days.map((day) => {
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const txsAfter = transactions.filter(
      (t) => new Date(t.created_at) > endOfDay
    );

    const sentAfter = txsAfter
      .filter((t) => t.sender_id === userId)
      .reduce((s, t) => s + Number(t.amount), 0);

    const receivedAfter = txsAfter
      .filter((t) => t.sender_id !== userId)
      .reduce((s, t) => s + Number(t.amount), 0);

    return {
      date: format(day, "MMM d"),
      balance: Number((balance + sentAfter - receivedAfter).toFixed(2)),
    };
  });

  // Top transactions
  const top5Sent = [...sent].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);
  const top5Received = [...received].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);

  return (
    <PageTransition>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-bold text-2xl text-[#1A1A1A]">Analytics</h1>
          <p className="font-inter text-sm text-[#6B6B6B] mt-1">Your financial insights</p>
        </div>

        {/* Period tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${period === p ? "gold-gradient text-white shadow-[0_2px_8px_rgba(245,166,35,0.3)]" : "border border-[#F0F0F0] bg-white text-[#6B6B6B] hover:text-[#F5A623] hover:border-[rgba(245,166,35,0.4)]"}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-2 border-[#F5A623] border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Spent", value: formatCurrency(totalSent), icon: ArrowUpRight, color: "#FF3B30" },
                { label: "Total Received", value: formatCurrency(totalReceived), icon: ArrowDownLeft, color: "#34C759" },
                { label: "Net Flow", value: formatCurrency(netFlow), icon: netFlow >= 0 ? TrendingUp : TrendingDown, color: netFlow >= 0 ? "#34C759" : "#FF3B30" },
                { label: "Transactions", value: transactions.length.toString(), icon: Activity, color: "#F5A623" },
              ].map(({ label, value, icon: Icon, color }) => (
                <GlassCard key={label} hover className="p-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}15` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <p className="font-inter text-xs text-[#6B6B6B] mb-1">{label}</p>
                  <p className="font-sora font-bold text-lg text-[#1A1A1A]">{value}</p>
                </GlassCard>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Donut chart */}
              <GlassCard className="p-5">
                <h3 className="font-sora font-bold text-base text-[#1A1A1A] mb-4">Spending by Category</h3>
                {categoryData.length === 0 ? (
                  <p className="text-center text-[#9B9B9B] font-inter text-sm py-8">No spending data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={GOLD_PALETTE[i % GOLD_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend formatter={(v) => <span className="text-xs font-inter text-[#6B6B6B]">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </GlassCard>

              {/* Balance line chart */}
              <GlassCard className="p-5">
                <h3 className="font-sora font-bold text-base text-[#1A1A1A] mb-4">Balance Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={balanceData}>
                    <defs>
                      <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9B9B9B" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "#9B9B9B" }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="balance" stroke="#F5A623" strokeWidth={2} fill="url(#balanceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </GlassCard>
            </div>

            {/* Top transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                { title: "Top 5 Sent", txs: top5Sent, isSent: true },
                { title: "Top 5 Received", txs: top5Received, isSent: false },
              ].map(({ title, txs, isSent }) => (
                <GlassCard key={title} className="p-5">
                  <h3 className="font-sora font-bold text-base text-[#1A1A1A] mb-4">{title}</h3>
                  {txs.length === 0 ? (
                    <p className="text-center text-[#9B9B9B] font-inter text-sm py-4">No data</p>
                  ) : (
                    <div className="space-y-3">
                      {txs.map((tx) => {
                        const other = isSent ? tx.receiver : tx.sender;
                        const name = other ? `${other.first_name} ${other.last_name}` : "Unknown";
                        return (
                          <div key={tx.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: `${CATEGORY_INFO[tx.category]?.color ?? "#9B9B9B"}18` }}>
                              {CATEGORY_INFO[tx.category]?.emoji ?? "💳"}
                            </div>
                            <p className="flex-1 font-inter text-sm text-[#1A1A1A] truncate">{name}</p>
                            <p className={`font-sora font-bold text-sm ${isSent ? "text-[#FF3B30]" : "text-[#34C759]"}`}>
                              {isSent ? "-" : "+"}€{Number(tx.amount).toFixed(2)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
