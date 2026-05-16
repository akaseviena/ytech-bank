import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check if profiles table exists
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("count")
    .limit(1);
  checks.profiles_table = profilesError ? `ERROR: ${profilesError.message} (code: ${profilesError.code})` : "OK";

  // Check if transactions table exists
  const { error: txError } = await supabaseAdmin
    .from("transactions")
    .select("count")
    .limit(1);
  checks.transactions_table = txError ? `ERROR: ${txError.message}` : "OK";

  // Check service role key is working
  const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
  checks.auth_admin = usersError ? `ERROR: ${usersError.message}` : `OK (${users?.users?.length ?? 0} users checked)`;

  // Check env vars are set
  checks.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING";
  checks.service_role_key = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING";

  return NextResponse.json(checks);
}
