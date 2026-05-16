import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  receiver_id: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().optional(),
  category: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { receiver_id, amount, description, category } = parsed.data;

  const { data, error } = await supabase.rpc("transfer_funds", {
    p_sender_id: user.id,
    p_receiver_id: receiver_id,
    p_amount: amount,
    p_description: description ?? null,
    p_category: category ?? "other",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.success) return NextResponse.json({ error: data?.error ?? "Transfer failed" }, { status: 400 });

  return NextResponse.json({ success: true });
}
