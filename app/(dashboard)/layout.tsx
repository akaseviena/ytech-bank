import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import { ToastProvider } from "@/components/ui/Toast";
import FeedbackButton from "@/components/ui/FeedbackButton";
import UsageBadge from "@/components/ui/UsageBadge";
import { DailyUsageProvider } from "@/contexts/DailyUsageContext";
import type { Profile, Notification } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,first_name,last_name,avatar_url,plan")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <ToastProvider>
      <DailyUsageProvider userId={user.id}>
        <div className="page-bg min-h-screen">
          <Sidebar
            profile={profile as Profile}
            notifications={(notifications ?? []) as Notification[]}
          />
          <main className="lg:pl-60 pb-20 lg:pb-0 min-h-screen">
            {children}
          </main>
          <BottomNav
            notifications={(notifications ?? []) as Notification[]}
            userId={user.id}
          />
          <FeedbackButton userEmail={user.email} />
          {/* Mobile-only fixed counter pill — desktop version lives in the Sidebar */}
          <UsageBadge variant="mobile-fixed" />
        </div>
      </DailyUsageProvider>
    </ToastProvider>
  );
}
