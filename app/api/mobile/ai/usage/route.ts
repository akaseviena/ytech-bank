import { requireUser } from "@/lib/mobile/auth";
import { getDailyUsage } from "@/lib/mobile/daily-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How many AI messages the signed-in person has sent today, out of how many,
// and when the count resets. The same number the web shows ("12/50"), so a
// person sees one figure on every screen. The chat and NeuroOffice streams
// carry the updated figure in their `done` event; this is for opening a screen.
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Authentication required." }, { status: 401 });
  }
  return Response.json(await getDailyUsage(user.id), { headers: { "Cache-Control": "no-store" } });
}
