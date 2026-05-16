"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { CATEGORY_INFO, type TransactionCategory, type Transaction } from "@/types";

const PAGE_SIZE = 20;
const STATUS_COLORS = { completed: "#34C759", pending: "#F5A623", failed: "#FF3B30" };

function HistoryContent() {
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const initialFilter: "all" | "sent" | "received" =
    urlFilter === "sent" || urlFilter === "received" ? urlFilter : "all";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "sent" | "received">(initialFilter);
  const [categoryFilter, setCategoryFilter] = useState<"all" | TransactionCategory>("all");

  const load = useCallback(async (reset = false) => {
    const supabase = createClient();
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
    }
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;

    setLoading(true);
    const p = reset ? 0 : page;

    // Two parallel queries so null-receiver withdrawals (subscriptions/fees) are never dropped
    // by an implicit INNER JOIN on the receiver profile.
    const [transfersRes, withdrawalsRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, sender:profiles!sender_id(id,first_name,last_name,email,avatar_url), receiver:profiles!receiver_id(id,first_name,last_name,email,avatar_url)")
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1),
      supabase
        .from("transactions")
        .select("*, sender:profiles!sender_id(id,first_name,last_name,email,avatar_url)")
        .eq("sender_id", uid)
        .is("receiver_id", null)
        .order("created_at", { ascending: false })
        .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1),
    ]);

    const seenIds = new Set<string>();
    const txs = [...(transfersRes.data ?? []), ...(withdrawalsRes.data ?? [])]
      .filter((tx) => {
        if (seenIds.has(tx.id)) return false;
        seenIds.add(tx.id);
        return categoryFilter === "all" || tx.category === categoryFilter;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, PAGE_SIZE) as Transaction[];

    const filtered = txs.filter((tx) => {
      const isWithdrawal = tx.type === "withdrawal" && tx.sender_id === uid && !tx.receiver_id;
      if (filter === "sent" && tx.sender_id !== uid) return false;
      // withdrawals with null receiver always count as "sent", never exclude them
      if (filter === "received" && (tx.sender_id === uid && !isWithdrawal)) return false;
      if (filter === "received" && isWithdrawal) return false;
      if (search) {
        const other = tx.sender_id === uid ? tx.receiver : tx.sender;
        const displayName = other
          ? `${other.first_name} ${other.last_name}`
          : isWithdrawal
          ? (tx.description ?? "Y-tech Bank")
          : "";
        if (
          !displayName.toLowerCase().includes(search.toLowerCase()) &&
          !(tx.description ?? "").toLowerCase().includes(search.toLowerCase())
        )
          return false;
      }
      return true;
    });

    if (reset) { setTransactions(filtered); setPage(1); }
    else { setTransactions((prev) => [...prev, ...filtered]); setPage(p + 1); }
    setHasMore(txs.length === PAGE_SIZE);
    setLoading(false);
  }, [userId, page, filter, categoryFilter, search]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { setUserId(user.id); }
    })();
  }, []);

  useEffect(() => {
    if (userId) load(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filter, categoryFilter, search]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#1A1A1A]">Transaction History</h1>
        <p className="font-inter text-sm text-[#6B6B6B] mt-1">All your transactions in one place</p>
      </div>

        {/* Filters */}
        <GlassCard className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or description…"
                className="input-field pl-10"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "sent", "received"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-xl text-xs font-inter font-semibold transition-all capitalize ${filter === f ? "gold-gradient text-white" : "border border-[rgba(245,166,35,0.3)] text-[#6B6B6B] hover:text-[#F5A623]"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as "all" | TransactionCategory)}
              className="input-field py-2 text-sm"
              style={{ width: "auto" }}
            >
              <option value="all">All categories</option>
              {Object.entries(CATEGORY_INFO).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          </div>
        </GlassCard>

        {/* Transaction list */}
        <div className="space-y-2">
          {transactions.map((tx, i) => {
            const isSent = tx.sender_id === userId;
            const isWithdrawal = tx.type === "withdrawal" && isSent && !tx.receiver_id;
            const catInfo = CATEGORY_INFO[tx.category] ?? CATEGORY_INFO.other;
            const other = isSent ? tx.receiver : tx.sender;
            const name = other
              ? `${other.first_name} ${other.last_name}`
              : isWithdrawal
              ? "Y-tech Bank"
              : isSent
              ? "External"
              : "Deposit";
            const expanded = expandedId === tx.id;

            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <GlassCard className="overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : tx.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-[rgba(245,166,35,0.03)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${catInfo.color}18` }}>
                      {catInfo.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-inter font-semibold text-sm text-[#1A1A1A] truncate">{name}</p>
                      <p className="font-inter text-xs text-[#9B9B9B] truncate">{tx.description || catInfo.label}</p>
                      {isWithdrawal && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-md bg-[rgba(107,107,107,0.1)] text-[10px] font-inter font-medium text-[#9B9B9B]">Subscription</span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className={`font-sora font-bold text-sm ${isSent ? "text-[#FF3B30]" : "text-[#34C759]"}`}>
                        {isSent ? "-" : "+"}€{Number(tx.amount).toFixed(2)}
                      </p>
                      <p className="font-inter text-[11px] text-[#9B9B9B]">{formatDateTime(tx.created_at).split(" · ")[0]}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {expanded ? <ChevronUp className="w-4 h-4 text-[#9B9B9B]" /> : <ChevronDown className="w-4 h-4 text-[#9B9B9B]" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-[rgba(245,166,35,0.1)]"
                      >
                        <div className="p-4 grid grid-cols-2 gap-3">
                          {[
                            { label: "Transaction ID", value: tx.id.slice(0, 12) + "…" },
                            { label: "Date & Time", value: formatDateTime(tx.created_at) },
                            { label: "Type", value: tx.type },
                            { label: "Status", value: tx.status, color: STATUS_COLORS[tx.status] },
                            { label: "Category", value: `${catInfo.emoji} ${catInfo.label}` },
                            ...(tx.description ? [{ label: "Note", value: tx.description }] : []),
                          ].map(({ label, value, color }) => (
                            <div key={label}>
                              <p className="font-inter text-[11px] text-[#9B9B9B] mb-0.5">{label}</p>
                              <p className="font-inter text-sm font-medium" style={{ color: color ?? "#1A1A1A" }}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </motion.div>
            );
          })}

          {!loading && transactions.length === 0 && (
            <EmptyState emoji="📋" title="No transactions found" description="Try adjusting your filters." />
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-[#F5A623] border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && hasMore && transactions.length > 0 && (
            <div className="text-center pt-4">
              <GoldButton variant="outline" onClick={() => load(false)}>Load more</GoldButton>
            </div>
          )}
        </div>
      </div>
  );
}

export default function HistoryPage() {
  return (
    <PageTransition>
      <Suspense fallback={
        <div className="p-6 flex justify-center pt-20">
          <div className="w-8 h-8 rounded-full border-2 border-[#F5A623] border-t-transparent animate-spin" />
        </div>
      }>
        <HistoryContent />
      </Suspense>
    </PageTransition>
  );
}
