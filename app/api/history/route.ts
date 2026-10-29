import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchTransfers, getMyAccount, resolveCounterparties, toItems } from "@/lib/ledger";

export const dynamic = "force-dynamic";

// The signed-in person's transfers, with the other side's name filled in.
// Used by /history (paged) and /analytics (a whole period, oldest first).
//
// Authorization: the account is derived from the session, never from the query
// string, and the transfers are read with the person's OWN client so row-level
// security applies. The service-role client is used for one thing only —
// turning the other side's account id into a display name.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = request.nextUrl.searchParams;
  const direction = p.get("direction");
  const since = p.get("since");
  const limit = Math.min(Math.max(Number(p.get("limit")) || 20, 1), 1000);
  const offset = Math.max(Number(p.get("offset")) || 0, 0);
  if (direction && direction !== "all" && direction !== "sent" && direction !== "received") {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }
  if (since && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "Invalid since" }, { status: 400 });
  }

  try {
    const account = await getMyAccount(supabase, user.id);
    if (!account) return NextResponse.json({ balanceMinor: 0, items: [], hasMore: false });

    // one extra row tells us whether another page exists
    const rows = await fetchTransfers(supabase, account.accountId, {
      limit: limit + 1,
      offset,
      since: since ?? undefined,
      direction: (direction as "all" | "sent" | "received" | null) ?? "all",
      category: p.get("category") ?? undefined,
      newestFirst: p.get("order") !== "asc",
    });
    const page = rows.slice(0, limit);
    const names = await resolveCounterparties(supabaseAdmin, page, account.accountId);

    return NextResponse.json({
      balanceMinor: account.balanceMinor,
      items: toItems(page, account.accountId, names),
      hasMore: rows.length > limit,
    });
  } catch (err) {
    console.error("[history] failed:", err);
    return NextResponse.json({ error: "Could not load history" }, { status: 500 });
  }
}
