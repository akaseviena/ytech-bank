"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";
import EmptyState from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { formatPence } from "@/lib/money";
import { LABEL_TEXT } from "@/lib/ledger";
import { CATEGORY_INFO, type TransactionCategory, type LedgerItem } from "@/types";

const PAGE_SIZE = 20;
const STATUS_COLORS = { completed: "#34C759", pending: "#F5C800", failed: "#FF3B30" };

function HistoryContent() {
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const initialFilter: "all" | "sent" | "received" =
    urlFilter === "sent" || urlFilter === "received" ? urlFilter : "all";

  const [transactions, setTransactions] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "sent" | "received">(initialFilter);
  const [categoryFilter, setCategoryFilter] = useState<"all" | TransactionCategory>("all");

  // One page of the person's ledger transfers, names already resolved by the
  // server. Direction and category are filtered by the database; the text
  // search runs on the page that came back, as it always did.
  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const p = reset ? 0 : page;
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(p * PAGE_SIZE), direction: filter });
    if (categoryFilter !== "all") qs.set("category", categoryFilter);

    const res = await fetch(`/api/history?${qs}`);
    if (!res.ok) { setLoading(false); return; }
    const data = (await res.json()) as { items: LedgerItem[]; hasMore: boolean };

    const needle = search.toLowerCase();
    const filtered = data.items.filter((tx) =>
      !needle ||
      tx.counterparty.name.toLowerCase().includes(needle) ||
      (tx.description ?? "").toLowerCase().includes(needle),
    );

    if (reset) { setTransactions(filtered); setPage(1); }
    else { setTransactions((prev) => [...prev, ...filtered]); setPage(p + 1); }
    setHasMore(data.hasMore);
    setLoading(false);
  }, [page, filter, categoryFilter, search]);

  useEffect(() => {
    load(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, categoryFilter, search]);

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
                  className={`px-3 py-2 rounded-xl text-xs font-inter font-semibold transition-all capitalize ${filter === f ? "gold-gradient text-[#3A2E00]" : "border border-[rgba(245,200,0,0.3)] text-[#6B6B6B] hover:text-[#F5C800]"}`}
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
            const isSent = tx.direction === "sent";
            const catInfo = CATEGORY_INFO[tx.category as TransactionCategory] ?? CATEGORY_INFO.other;
            const name = tx.counterparty.name;
            // welcome bonus / balance adjustment carry a fixed caption rather than
            // the long posting text; the full text stays in the expanded note
            const caption = tx.label === "welcome" || tx.label === "adjustment"
              ? LABEL_TEXT[tx.label]
              : tx.description || catInfo.label;
            const kind = tx.label === "welcome" ? "deposit" : tx.label === "adjustment" ? "adjustment" : tx.label === "subscription" ? "withdrawal" : "transfer";
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
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-[rgba(245,200,0,0.03)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${catInfo.color}18` }}>
                      {catInfo.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-inter font-semibold text-sm text-[#1A1A1A] truncate">{name}</p>
                      <p className="font-inter text-xs text-[#9B9B9B] truncate">{caption}</p>
                      {tx.label && tx.label !== "subscription" && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-md bg-[rgba(107,107,107,0.1)] text-[10px] font-inter font-medium text-[#9B9B9B]">{LABEL_TEXT[tx.label]}</span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className={`font-sora font-bold text-sm ${isSent ? "text-[#FF3B30]" : "text-[#34C759]"}`}>
                        {isSent ? "-" : "+"}{formatPence(tx.amountMinor)}
                      </p>
                      <p className="font-inter text-[11px] text-[#9B9B9B]">{formatDateTime(tx.createdAt).split(" · ")[0]}</p>
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
                        className="overflow-hidden border-t border-[rgba(245,200,0,0.1)]"
                      >
                        <div className="p-4 grid grid-cols-2 gap-3">
                          {[
                            { label: "Transaction ID", value: tx.id.slice(0, 12) + "…" },
                            { label: "Date & Time", value: formatDateTime(tx.createdAt) },
                            { label: "Type", value: kind },
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
              <div className="w-8 h-8 rounded-full border-2 border-[#F5C800] border-t-transparent animate-spin" />
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
          <div className="w-8 h-8 rounded-full border-2 border-[#F5C800] border-t-transparent animate-spin" />
        </div>
      }>
        <HistoryContent />
      </Suspense>
    </PageTransition>
  );
}
