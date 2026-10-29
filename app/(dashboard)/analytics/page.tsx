"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart
} from "recharts";
import { subDays, subMonths, subYears, format, startOfDay, eachDayOfInterval } from "date-fns";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";
import { formatPence } from "@/lib/money";
import { CATEGORY_INFO, type TransactionCategory, type LedgerItem } from "@/types";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Activity } from "lucide-react";

type Period = "week" | "month" | "3months" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  week: "Week",
  month: "Month",
  "3months": "3 Months",
  year: "Year",
};


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
  const [transactions, setTransactions] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceMinor, setBalanceMinor] = useState(0);

  // The whole period, oldest first, with names resolved by the server.
  useEffect(() => {
    (async () => {
      setLoading(true);
      const qs = new URLSearchParams({ limit: "1000", order: "asc", since: getStartDate(period).toISOString() });
      const res = await fetch(`/api/history?${qs}`);
      if (res.ok) {
        const data = (await res.json()) as { items: LedgerItem[]; balanceMinor: number };
        setTransactions(data.items);
        setBalanceMinor(data.balanceMinor);
      }
      setLoading(false);
    })();
  }, [period]);

  // Totals, categories and the top lists count what the person did: completed
  // transfers, not the welcome bonus or balance adjustments. The balance chart
  // below uses every posting, because those do move the balance.
  const flows = transactions.filter(
    (t) => t.status === "completed" && t.label !== "welcome" && t.label !== "adjustment",
  );
  const sent = flows.filter((t) => t.direction === "sent");
  const received = flows.filter((t) => t.direction === "received");
  const sumPence = (xs: LedgerItem[]) => xs.reduce((acc, t) => acc + t.amountMinor, 0);
  const totalSent = sumPence(sent);
  const totalReceived = sumPence(received);
  const netFlow = totalReceived - totalSent;

  // Category breakdown, in integer pence
  const categoryMap: Partial<Record<TransactionCategory, number>> = {};
  sent.forEach((t) => {
    const c = t.category as TransactionCategory;
    categoryMap[c] = (categoryMap[c] ?? 0) + t.amountMinor;
  });
  const categoryData = Object.entries(categoryMap)
    .map(([cat, value]) => ({
      name: CATEGORY_INFO[cat as TransactionCategory]?.label ?? cat,
      value: value as number,
      emoji: CATEGORY_INFO[cat as TransactionCategory]?.emoji ?? "💳",
      color: CATEGORY_INFO[cat as TransactionCategory]?.color ?? "#9B9B9B",
    }))
    .sort((a, b) => b.value - a.value);

  // Balance over time — work BACKWARDS from the real current balance.
  // For each day d, undo every completed posting that happened AFTER that day:
  //   outgoing after d → add back (balance was higher before it left)
  //   incoming after d → subtract back (balance was lower before it arrived)
  const days = eachDayOfInterval({ start: getStartDate(period), end: new Date() });
  const balanceData = days.map((day) => {
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const after = transactions.filter((t) => t.status === "completed" && new Date(t.createdAt) > endOfDay);
    const sentAfter = sumPence(after.filter((t) => t.direction === "sent"));
    const receivedAfter = sumPence(after.filter((t) => t.direction === "received"));

    return {
      date: format(day, "MMM d"),
      balance: balanceMinor + sentAfter - receivedAfter, // pence
    };
  });

  // Top transactions
  const top5Sent = [...sent].sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 5);
  const top5Received = [...received].sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 5);

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
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${period === p ? "gold-gradient text-[#3A2E00] shadow-[0_2px_8px_rgba(245,200,0,0.3)]" : "border border-[#F0F0F0] bg-white text-[#6B6B6B] hover:text-[#F5C800] hover:border-[rgba(245,200,0,0.4)]"}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-2 border-[#F5C800] border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Spent", value: formatPence(totalSent), icon: ArrowUpRight, color: "#FF3B30" },
                { label: "Total Received", value: formatPence(totalReceived), icon: ArrowDownLeft, color: "#34C759" },
                { label: "Net Flow", value: formatPence(netFlow), icon: netFlow >= 0 ? TrendingUp : TrendingDown, color: netFlow >= 0 ? "#34C759" : "#FF3B30" },
                { label: "Transactions", value: flows.length.toString(), icon: Activity, color: "#F5C800" },
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
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                          cornerRadius={6}
                        >
                          {categoryData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatPence(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                      {categoryData.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                          <span className="text-xs font-inter text-[#6B6B6B] truncate">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </GlassCard>

              {/* Balance line chart */}
              <GlassCard className="p-5">
                <h3 className="font-sora font-bold text-base text-[#1A1A1A] mb-4">Balance Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={balanceData}>
                    <defs>
                      <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F5C800" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F5C800" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9B9B9B" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "#9B9B9B" }} tickFormatter={(v: number) => formatPence(v).replace(/\.00$/, "")} />
                    <Tooltip formatter={(v: number) => formatPence(v)} />
                    <Area type="monotone" dataKey="balance" stroke="#F5C800" strokeWidth={2} fill="url(#balanceGrad)" />
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
                        const name = tx.counterparty.name;
                        const info = CATEGORY_INFO[tx.category as TransactionCategory];
                        return (
                          <div key={tx.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: `${info?.color ?? "#9B9B9B"}18` }}>
                              {info?.emoji ?? "💳"}
                            </div>
                            <p className="flex-1 font-inter text-sm text-[#1A1A1A] truncate">{name}</p>
                            <p className={`font-sora font-bold text-sm ${isSent ? "text-[#FF3B30]" : "text-[#34C759]"}`}>
                              {isSent ? "-" : "+"}{formatPence(tx.amountMinor)}
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
