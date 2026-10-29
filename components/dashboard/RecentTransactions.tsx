"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { formatPence } from "@/lib/money";
import { LABEL_TEXT } from "@/lib/ledger";
import { CATEGORY_INFO } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import type { LedgerItem } from "@/types";

interface RecentTransactionsProps {
  transactions: LedgerItem[];
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base text-[#1A1A1A]">Recent Transactions</h3>
        <Link href="/history" className="text-sm text-[#F5C800] hover:text-[#EFC000] transition-colors font-semibold">
          See all
        </Link>
      </div>

      {transactions.length === 0 ? (
        <EmptyState emoji="💸" title="No transactions yet" description="Your recent transactions will appear here." />
      ) : (
        <div className="space-y-1">
          {transactions.map((tx, i) => {
            const isSent = tx.direction === "sent";
            const categoryInfo = CATEGORY_INFO[tx.category as keyof typeof CATEGORY_INFO] ?? CATEGORY_INFO.other;
            const name = tx.counterparty.name;

            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-default border border-transparent hover:border-[rgba(245,200,0,0.4)] hover:bg-[rgba(245,200,0,0.03)] hover:shadow-[0_0_0_3px_rgba(245,200,0,0.08)]"
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `${categoryInfo.color}15` }}
                >
                  {categoryInfo.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#1A1A1A] truncate">{name}</p>
                  <p className="text-xs text-[#9B9B9B] font-medium">
                    {tx.label && tx.label !== "subscription" ? `${LABEL_TEXT[tx.label]} · ` : ""}{formatRelativeTime(tx.createdAt)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-sm ${isSent ? "text-[#FF3B30]" : "text-[#34C759]"}`}>
                    {isSent ? "-" : "+"}
                    {formatPence(tx.amountMinor)}
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
