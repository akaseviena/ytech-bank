import { contextLayout } from "@/lib/context-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What reaches the model for each assistant and agent: the table the context
// builders read (lib/context-fields.ts) and the numbers that go with it.
//
// For a pre-release check, not for the app at run time: the app's consent screen
// keeps its own written copy of this layout, and a check compares the two and fails
// if they differ. It is public on purpose — it holds no one's data and says what the
// privacy policy already says — so the check needs no account. Never cached, so the
// answer is the deployed code's.
export async function GET() {
  return Response.json(contextLayout(), { headers: { "Cache-Control": "no-store" } });
}
