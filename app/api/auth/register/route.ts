import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  plan: z.enum(["basic", "standard", "travel", "metal", "ultimate", "business"]).default("basic"),
});

function generateAccountNumber(): string {
  const num = Math.floor(Math.random() * 1_000_000_000);
  return "YT" + String(num).padStart(9, "0");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password, firstName, lastName, dateOfBirth, plan } = parsed.data;

  // Create the auth user via admin API
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, plan },
  });

  if (authError) {
    console.error("[register] createUser failed:", authError.message, authError.status);

    // The handle_new_user trigger is still blocking auth user creation.
    // User must run supabase/fix-registration.sql in Supabase SQL Editor.
    if (
      authError.message.includes("Database error") ||
      authError.status === 500
    ) {
      return NextResponse.json(
        {
          error:
            "Database trigger error. Please run supabase/fix-registration.sql in your Supabase SQL Editor, then try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  // Generate a unique account number (fallback if trigger didn't create profile)
  let accountNumber = generateAccountNumber();
  for (let i = 0; i < 10; i++) {
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("account_number", accountNumber)
      .maybeSingle();
    if (!existing) break;
    accountNumber = generateAccountNumber();
  }

  // Upsert profile — handles both cases:
  // 1. Trigger already created it (just update plan/dob which trigger doesn't set)
  // 2. Trigger failed silently (EXCEPTION block) — create the profile now
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth || null,
      plan,
      account_number: accountNumber,
      balance: 1000.0,
      currency: "EUR",
      card_frozen: false,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    // Profile creation failed — roll back auth user to avoid orphan
    await supabaseAdmin.auth.admin.deleteUser(userId);
    console.error("[register] profile upsert failed:", profileError.message);
    return NextResponse.json(
      { error: "Failed to create profile. Ensure supabase/schema.sql has been applied." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
