import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageTransition from "@/components/ui/PageTransition";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import GoldButton from "@/components/ui/GoldButton";
import { AGENTS, AGENT_PLAN_ACCESS, NEUROOFFICE_PLANS, type Plan } from "@/types";

export default async function NeuroOfficePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("plan, first_name").eq("id", user.id).single();
  const plan = (profile?.plan ?? "basic") as Plan;
  const hasAccess = NEUROOFFICE_PLANS.includes(plan);
  const allowedAgents = AGENT_PLAN_ACCESS[plan] ?? [];

  return (
    <PageTransition>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl gold-gradient flex items-center justify-center shadow-[0_2px_8px_rgba(245,166,35,0.3)]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-2xl text-[#1A1A1A]">NeuroOffice</h1>
          </div>
          <p className="text-sm text-[#6B6B6B] ml-13 pl-0 mt-1">Your AI-powered business team</p>
        </div>

        {/* Locked screen */}
        {!hasAccess ? (
          <div className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 blur-sm pointer-events-none select-none opacity-60 mb-0">
              {AGENTS.slice(0, 4).map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-[20px] p-6"
                  style={{ background: "#FFFFFF", border: "1px solid #F0F0F0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
                >
                  <div className="text-5xl mb-4">{agent.emoji}</div>
                  <h3 className="font-bold text-lg text-[#1A1A1A] mb-1">{agent.name}</h3>
                  <p className="text-sm text-[#6B6B6B]">{agent.description}</p>
                </div>
              ))}
            </div>

            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-[24px] p-8 text-center"
              style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(2px)" }}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                style={{
                  background: "rgba(245,166,35,0.1)",
                  border: "2px solid rgba(245,166,35,0.4)",
                  boxShadow: "0 0 32px rgba(245,166,35,0.25)",
                }}
              >
                <Lock className="w-9 h-9 text-[#F5A623]" />
              </div>
              <h2 className="font-bold text-xl text-[#1A1A1A] mb-2">
                NeuroOffice is not available on your plan
              </h2>
              <p className="text-sm text-[#6B6B6B] mb-6 max-w-xs">
                Upgrade to Metal, Ultimate, or Business to unlock your AI-powered business team
              </p>
              <Link href="/settings">
                <GoldButton size="lg">Upgrade Plan</GoldButton>
              </Link>
            </div>
          </div>
        ) : (
          /* Agent grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AGENTS.map((agent) => {
              const isLocked = !allowedAgents.includes(agent.id);

              if (isLocked) {
                return (
                  <Link
                    key={agent.id}
                    href="/settings"
                    className="group rounded-[20px] p-6 flex flex-col relative overflow-hidden transition-all duration-200 bg-white border border-[#F0F0F0] shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-[rgba(245,166,35,0.6)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.15),_0_4px_20px_rgba(245,166,35,0.2)]"
                  >
                    {/* Lock overlay */}
                    <div
                      className="absolute inset-0 z-10 rounded-[20px] flex flex-col items-center justify-center gap-2 p-4"
                      style={{ background: "rgba(255,255,255,0.88)" }}
                    >
                      <Lock className="w-6 h-6 text-[#9B9B9B]" />
                      <p className="text-xs font-semibold text-[#9B9B9B] text-center">
                        Upgrade to unlock
                      </p>
                      <span className="flex items-center gap-1 text-xs font-semibold text-[#F5A623] group-hover:underline">
                        Go to settings <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                    {/* Blurred content behind overlay */}
                    <div className="text-5xl mb-4 opacity-30">{agent.emoji}</div>
                    <h3 className="font-bold text-lg text-[#9B9B9B] mb-1">{agent.name}</h3>
                    <p className="text-sm text-[#C0C0C0] flex-1">{agent.description}</p>
                  </Link>
                );
              }

              return (
                <Link
                  key={agent.id}
                  href={agent.route}
                  className="rounded-[20px] p-6 flex flex-col transition-all duration-200 bg-white border border-[#F0F0F0] shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-[rgba(245,166,35,0.6)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.15),_0_4px_20px_rgba(245,166,35,0.2)]"
                >
                  <div className="text-5xl mb-4">{agent.emoji}</div>
                  <h3 className="font-bold text-lg text-[#1A1A1A] mb-1">{agent.name}</h3>
                  <p className="text-sm text-[#6B6B6B] flex-1 mb-4">{agent.description}</p>
                  <div className="mt-auto w-full px-4 py-2 rounded-xl text-center text-sm font-bold text-white gold-gradient shadow-[0_2px_8px_rgba(245,166,35,0.3)]">
                    Open
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
