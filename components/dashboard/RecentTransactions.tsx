"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { CATEGORY_INFO } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import type { Transaction } from "@/types";

interface RecentTransactionsProps {
  transactions: Transaction[];
  userId: string;
}

export default function RecentTransactions({ transactions, userId }: RecentTransactionsProps) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base text-[#1A1A1A]">Recent Transactions</h3>
        <Link href="/history" className="text-sm text-[#F5A623] hover:text-[#C8860A] transition-colors font-semibold">
          See all
        </Link>
      </div>

      {transactions.length === 0 ? (
        <EmptyState emoji="💸" title="No transactions yet" description="Your recent transactions will appear here." />
      ) : (
        <div className="space-y-1">
          {transactions.map((tx, i) => {
            const isSent = tx.sender_id === userId;
            const categoryInfo = CATEGORY_INFO[tx.category] ?? CATEGORY_INFO.other;
            const other = isSent ? tx.receiver : tx.sender;
            const name = other
              ? `${other.first_name} ${other.last_name}`
              : isSent ? "External" : "Deposit";

            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-default border border-transparent hover:border-[rgba(245,166,35,0.4)] hover:bg-[rgba(245,166,35,0.03)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.08)]"
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `${categoryInfo.color}15` }}
                >
                  {categoryInfo.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#1A1A1A] truncate">{name}</p>
                  <p className="text-xs text-[#9B9B9B] font-medium">{formatRelativeTime(tx.created_at)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-sm ${isSent ? "text-[#FF3B30]" : "text-[#34C759]"}`}>
                    {isSent ? "-" : "+"}
                    {formatCurrency(tx.amount)}
                  </p>
                  <div className={`flex items-center justify-end gap-0.5 ${isSent ? "text-[#FF3B30]" : "text-[#34C759]"}`}>
                    {isSent ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                    <span className="text-[10px] font-semibold capitalize">{isSent ? "sent" : "received"}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
