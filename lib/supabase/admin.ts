import { createClient } from "@supabase/supabase-js";
import { noStoreFetch } from "@/lib/supabase/no-store-fetch";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: noStoreFetch } }
);
