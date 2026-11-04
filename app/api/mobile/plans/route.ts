import { admin } from "@/lib/mobile/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The plan table as the database holds it: what each plan is called, what it costs, whether it can be
// bought, and the note written on its charge. Public and never cached, like context-fields: it holds no personal data,
// and it exists so a hand-written copy of the table can be checked against the server before a
// release (`npm run check:plans` here, check-plans in the app's repository). The price a person
// pays is never taken from a copy: change_plan reads it from this same table.
//
//   GET /api/mobile/plans
//   200 { plans: [{ id, label, priceMinor, priceFrom, purchasable, chargeDescription }] }   cheapest first
//
// priceFrom: the price is a "from" price (Business). purchasable: change_plan will switch to it
// (Business is not sold by a button). chargeDescription is null for a plan that is free or not sold.
export async function GET() {
  const { data, error } = await admin
    .from("plans")
    .select("plan, name, price_minor, price_from, purchasable, charge_description")
    .order("price_minor", { ascending: true });

  if (error || !data) {
    console.error("[mobile/plans] read failed:", error);
    return Response.json({ error: "upstream_error", message: "Could not load the plans." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    {
      plans: data.map((p) => ({
        id: p.plan as string,
        label: p.name as string,
        priceMinor: Number(p.price_minor),
        priceFrom: p.price_from === true,
        purchasable: p.purchasable === true,
        chargeDescription: (p.charge_description as string | null) ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
