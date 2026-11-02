import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    // named columns: the profile row also holds balance and card_frozen, which belonged to the
    // old money rail and no longer move — money is read from the ledger, the card from card_get()
    .select("id,first_name,last_name,avatar_url,plan,account_number,currency,card_color,created_at")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ profile });
}
