import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageTransition from "@/components/ui/PageTransition";
import BalanceCard from "@/components/dashboard/BalanceCard";
import VirtualCard from "@/components/dashboard/VirtualCard";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import SavingsGoals from "@/components/dashboard/SavingsGoals";
import GlassCard from "@/components/ui/GlassCard";
import { formatPence } from "@/lib/money";
import { fetchTransfers, getMyAccount, resolveCounterparties, toItems, totals } from "@/lib/ledger";
import type { Profile, SavingsGoal } from "@/types";
import { ArrowUpRight, ArrowDownLeft, Activity } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, account, goalsRes] = await Promise.all([
    supabase.from("profiles").select("id,first_name,last_name,plan,account_number,card_frozen,card_color,created_at,currency").eq("id", user.id).single(),
    getMyAccount(supabase, user.id),
    supabase.from("savings_goals").select("*").eq("user_id", user.id).order("created_at"),
  ]);

  if (!profileRes.data) redirect("/login");

  const profile = profileRes.data as Profile;
  const goals = (goalsRes.data ?? []) as SavingsGoal[];

  // Money comes from the ledger. Reads use the signed-in person's own client
  // (row-level security); the service role only resolves counterparty names.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const [recentRows, monthRows] = account
    ? await Promise.all([
        fetchTransfers(supabase, account.accountId, { limit: 5 }),
        fetchTransfers(supabase, account.accountId, { limit: 1000, since: monthStart }),
      ])
    : [[], []];
  const names = account ? await resolveCounterparties(supabaseAdmin, recentRows, account.accountId) : new Map();
  const transactions = account ? toItems(recentRows, account.accountId, names) : [];
  const balanceMinor = account?.balanceMinor ?? 0;

  // Welcome bonus and balance adjustments are listed above but are not
  // "sent"/"received" — totals() counts person-initiated transfers only.
  const month = account ? totals(monthRows, account.accountId) : { sent: 0, received: 0, count: 0 };
  const sent = month.sent;
  const received = month.received;
  const count = month.count;

  return (
    <PageTransition>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="font-bold text-2xl text-[#1A1A1A]">
            Good day, {profile.first_name} 👋
          </h1>
          <p className="text-sm text-[#6B6B6B] mt-1">Here&apos;s your financial overview</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="xl:col-span-2 space-y-6">
            <BalanceCard profile={profile} balanceMinor={balanceMinor} accountRef={account?.ibanDisplay ?? null} />

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              <Link href="/history?filter=sent" className="block">
                <GlassCard className="p-4 cursor-pointer transition-all duration-200 hover:border-[rgba(245,200,0,0.6)] hover:shadow-[0_0_0_3px_rgba(245,200,0,0.15),_0_4px_20px_rgba(245,200,0,0.2)]">
                  <div className="w-8 h-8 rounded-xl bg-[rgba(255,59,48,0.1)] flex items-center justify-center mb-3">
                    <ArrowUpRight className="w-4 h-4 text-[#FF3B30]" />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mb-1">Sent this month</p>
                  <p className="font-bold text-base text-[#1A1A1A]">{formatPence(sent)}</p>
                </GlassCard>
              </Link>
              <Link href="/history?filter=received" className="block">
                <GlassCard className="p-4 cursor-pointer transition-all duration-200 hover:border-[rgba(245,200,0,0.6)] hover:shadow-[0_0_0_3px_rgba(245,200,0,0.15),_0_4px_20px_rgba(245,200,0,0.2)]">
                  <div className="w-8 h-8 rounded-xl bg-[rgba(52,199,89,0.1)] flex items-center justify-center mb-3">
                    <ArrowDownLeft className="w-4 h-4 text-[#34C759]" />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mb-1">Received</p>
                  <p className="font-bold text-base text-[#1A1A1A]">{formatPence(received)}</p>
                </GlassCard>
              </Link>
              <Link href="/history?filter=all" className="block">
                <GlassCard className="p-4 cursor-pointer transition-all duration-200 hover:border-[rgba(245,200,0,0.6)] hover:shadow-[0_0_0_3px_rgba(245,200,0,0.15),_0_4px_20px_rgba(245,200,0,0.2)]">
                  <div className="w-8 h-8 rounded-xl bg-[rgba(245,200,0,0.1)] flex items-center justify-center mb-3">
                    <Activity className="w-4 h-4 text-[#F5C800]" />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mb-1">Transactions</p>
                  <p className="font-bold text-base text-[#1A1A1A]">{count}</p>
                </GlassCard>
              </Link>
            </div>

            <RecentTransactions transactions={transactions} />
            <SavingsGoals goals={goals} userId={user.id} balanceMinor={balanceMinor} />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <GlassCard className="p-5">
              <h3 className="font-bold text-base text-[#1A1A1A] mb-4">Virtual Card</h3>
              <VirtualCard profile={profile} />
            </GlassCard>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
