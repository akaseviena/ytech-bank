import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageTransition from "@/components/ui/PageTransition";
import BalanceCard from "@/components/dashboard/BalanceCard";
import VirtualCard from "@/components/dashboard/VirtualCard";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import SavingsGoals from "@/components/dashboard/SavingsGoals";
import GlassCard from "@/components/ui/GlassCard";
import { formatCurrency } from "@/lib/utils";
import type { Profile, Transaction, SavingsGoal } from "@/types";
import { ArrowUpRight, ArrowDownLeft, Activity } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, txRes, goalsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("transactions")
      .select("*, sender:profiles!sender_id(id,first_name,last_name,email,avatar_url), receiver:profiles!receiver_id(id,first_name,last_name,email,avatar_url)")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("savings_goals").select("*").eq("user_id", user.id).order("created_at"),
  ]);

  if (!profileRes.data) redirect("/login");

  const profile = profileRes.data as Profile;
  const transactions = (txRes.data ?? []) as Transaction[];
  const goals = (goalsRes.data ?? []) as SavingsGoal[];

  // Monthly stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: monthTx } = await supabase
    .from("transactions")
    .select("amount, sender_id, type")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .gte("created_at", monthStart);

  const sent = (monthTx ?? []).filter((t) => t.sender_id === user.id).reduce((s, t) => s + Number(t.amount), 0);
  const received = (monthTx ?? []).filter((t) => t.sender_id !== user.id).reduce((s, t) => s + Number(t.amount), 0);
  const count = (monthTx ?? []).length;

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
            <BalanceCard profile={profile} />

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              <Link href="/history?filter=sent" className="block">
                <GlassCard className="p-4 cursor-pointer transition-all duration-200 hover:border-[rgba(245,166,35,0.6)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.15),_0_4px_20px_rgba(245,166,35,0.2)]">
                  <div className="w-8 h-8 rounded-xl bg-[rgba(255,59,48,0.1)] flex items-center justify-center mb-3">
                    <ArrowUpRight className="w-4 h-4 text-[#FF3B30]" />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mb-1">Sent this month</p>
                  <p className="font-bold text-base text-[#1A1A1A]">{formatCurrency(sent)}</p>
                </GlassCard>
              </Link>
              <Link href="/history?filter=received" className="block">
                <GlassCard className="p-4 cursor-pointer transition-all duration-200 hover:border-[rgba(245,166,35,0.6)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.15),_0_4px_20px_rgba(245,166,35,0.2)]">
                  <div className="w-8 h-8 rounded-xl bg-[rgba(52,199,89,0.1)] flex items-center justify-center mb-3">
                    <ArrowDownLeft className="w-4 h-4 text-[#34C759]" />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mb-1">Received</p>
                  <p className="font-bold text-base text-[#1A1A1A]">{formatCurrency(received)}</p>
                </GlassCard>
              </Link>
              <Link href="/history?filter=all" className="block">
                <GlassCard className="p-4 cursor-pointer transition-all duration-200 hover:border-[rgba(245,166,35,0.6)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.15),_0_4px_20px_rgba(245,166,35,0.2)]">
                  <div className="w-8 h-8 rounded-xl bg-[rgba(245,166,35,0.1)] flex items-center justify-center mb-3">
                    <Activity className="w-4 h-4 text-[#F5A623]" />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mb-1">Transactions</p>
                  <p className="font-bold text-base text-[#1A1A1A]">{count}</p>
                </GlassCard>
              </Link>
            </div>

            <RecentTransactions transactions={transactions} userId={user.id} />
            <SavingsGoals goals={goals} userId={user.id} userBalance={profile.balance} />
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
