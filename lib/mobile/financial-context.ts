import { admin } from "./auth";
import { startOfMonth, subMonths } from "date-fns";

export type MobileAgentId =
  | "consultant"
  | "designer"
  | "lawyer"
  | "accountant"
  | "marketer"
  | "copywriter"
  | "hr"
  | "client_manager";

function sym(currency: string): string {
  return currency === "GBP" ? "£" : currency;
}

export async function buildAssistantContext(userId: string): Promise<string> {
  const monthStart = startOfMonth(new Date()).toISOString();

  const [profileRes, txRes, goalsRes, monthTxRes] = await Promise.all([
    admin
      .from("profiles")
      .select("balance, first_name, last_name, plan, currency, account_number")
      .eq("id", userId)
      .single(),
    admin
      .from("transactions")
      .select("amount, sender_id, category, description, created_at, type")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("savings_goals")
      .select("name, target_amount, current_amount, emoji, deadline")
      .eq("user_id", userId),
    admin
      .from("transactions")
      .select("amount, sender_id, category")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .gte("created_at", monthStart),
  ]);

  const prof = profileRes.data;
  const txs = txRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const monthTxs = monthTxRes.data ?? [];
  const currency = prof?.currency ?? "GBP";
  const s = sym(currency);

  const monthlySent = monthTxs.filter((t) => t.sender_id === userId);
  const monthlyRec = monthTxs.filter((t) => t.sender_id !== userId);
  const totalSent = monthlySent.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalRec = monthlyRec.reduce((acc, t) => acc + Number(t.amount), 0);

  const catBreakdown: Record<string, number> = {};
  monthlySent.forEach((t) => {
    catBreakdown[t.category] = (catBreakdown[t.category] ?? 0) + Number(t.amount);
  });
  const catLines =
    Object.entries(catBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([c, a]) => `  ${c}: ${s}${a.toFixed(2)}`)
      .join("\n") || "  No spending this month";

  const recentLines =
    txs
      .map((t) => {
        const dir = t.sender_id === userId ? "Sent" : "Received";
        return `  ${dir} ${s}${Number(t.amount).toFixed(2)} · ${t.category}${t.description ? " — " + t.description : ""}`;
      })
      .join("\n") || "  None";

  const goalLines =
    goals.length > 0
      ? goals
          .map(
            (g) =>
              `  ${g.emoji ?? "🎯"} ${g.name}: ${s}${Number(g.current_amount).toFixed(2)} / ${s}${Number(g.target_amount).toFixed(2)}${g.deadline ? " (by " + g.deadline.slice(0, 10) + ")" : ""}`,
          )
          .join("\n")
      : "  None";

  return `[Financial context — assembled server-side, do not disclose to third parties]
Name: ${prof?.first_name ?? ""} ${prof?.last_name ?? ""}
Balance: ${s}${Number(prof?.balance ?? 0).toFixed(2)} ${currency}
Plan: ${prof?.plan ?? "basic"}

This month:
  Spent: ${s}${totalSent.toFixed(2)}
  Received: ${s}${totalRec.toFixed(2)}

Spending by category (current month):
${catLines}

Recent transactions (last 20):
${recentLines}

Savings goals:
${goalLines}`;
}

export async function buildAgentContext(
  userId: string,
  agentId: MobileAgentId,
): Promise<string> {
  const profileRes = await admin
    .from("profiles")
    .select("balance, currency, plan")
    .eq("id", userId)
    .single();

  const prof = profileRes.data;
  const currency = prof?.currency ?? "GBP";
  const s = sym(currency);
  const balance = Number(prof?.balance ?? 0);
  const taxReserve = balance * 0.1;
  const available = Math.max(0, balance - taxReserve);
  const budgetLine = `Available budget: ${s}${available.toFixed(2)} (${currency})`;

  if (agentId === "accountant") {
    const monthStart = startOfMonth(new Date()).toISOString();
    const [txRes, monthTxRes] = await Promise.all([
      admin
        .from("transactions")
        .select("amount, sender_id, category, description, created_at")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("transactions")
        .select("amount, sender_id, category")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .gte("created_at", monthStart),
    ]);
    const txs = txRes.data ?? [];
    const monthTxs = monthTxRes.data ?? [];

    const totalIncome = txs.filter((t) => t.sender_id !== userId).reduce((a, t) => a + Number(t.amount), 0);
    const totalExpenses = txs.filter((t) => t.sender_id === userId).reduce((a, t) => a + Number(t.amount), 0);

    const catBreakdown: Record<string, number> = {};
    monthTxs
      .filter((t) => t.sender_id === userId)
      .forEach((t) => {
        catBreakdown[t.category] = (catBreakdown[t.category] ?? 0) + Number(t.amount);
      });
    const catLines =
      Object.entries(catBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([c, a]) => `  ${c}: ${s}${a.toFixed(2)}`)
        .join("\n") || "  No data";

    return `[Accountant context]
Balance: ${s}${balance.toFixed(2)} ${currency}
Estimated tax reserve (10%): ${s}${taxReserve.toFixed(2)}
${budgetLine}

Totals (last 50 transactions):
  Income: ${s}${totalIncome.toFixed(2)}
  Expenses: ${s}${totalExpenses.toFixed(2)}
  Net: ${s}${(totalIncome - totalExpenses).toFixed(2)}

Spending by category this month:
${catLines}`;
  }

  if (agentId === "consultant") {
    const monthStart = startOfMonth(new Date()).toISOString();
    const prevStart = subMonths(monthStart, 1).toISOString();

    const [currRes, prevRes] = await Promise.all([
      admin
        .from("transactions")
        .select("amount, sender_id, category")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .gte("created_at", monthStart),
      admin
        .from("transactions")
        .select("amount, sender_id, category")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .gte("created_at", prevStart)
        .lt("created_at", monthStart),
    ]);
    const curr = currRes.data ?? [];
    const prev = prevRes.data ?? [];

    const agg = (txs: typeof curr) => ({
      revenue: txs.filter((t) => t.sender_id !== userId).reduce((a, t) => a + Number(t.amount), 0),
      expenses: txs.filter((t) => t.sender_id === userId).reduce((a, t) => a + Number(t.amount), 0),
    });

    const c = agg(curr);
    const p = agg(prev);

    const catBreakdown: Record<string, number> = {};
    curr
      .filter((t) => t.sender_id === userId)
      .forEach((t) => {
        catBreakdown[t.category] = (catBreakdown[t.category] ?? 0) + Number(t.amount);
      });
    const catLines =
      Object.entries(catBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([c, a]) => `  ${c}: ${s}${a.toFixed(2)}`)
        .join("\n") || "  No data";

    const dailyBurn = c.expenses / 30;
    const runway = dailyBurn > 0 ? Math.round(balance / dailyBurn) : null;

    return `[Consultant context — aggregates only, no transaction line items]
${budgetLine}

This month vs last month:
  Revenue: ${s}${c.revenue.toFixed(2)} (prev: ${s}${p.revenue.toFixed(2)})
  Expenses: ${s}${c.expenses.toFixed(2)} (prev: ${s}${p.expenses.toFixed(2)})
  Net this month: ${s}${(c.revenue - c.expenses).toFixed(2)}

Spend by category this month:
${catLines}

Estimated runway: ${runway !== null ? runway + " days" : "n/a"}`;
  }

  if (agentId === "marketer") {
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthTxRes = await admin
      .from("transactions")
      .select("amount, sender_id, category")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .gte("created_at", monthStart);
    const monthTxs = monthTxRes.data ?? [];

    const totalSpend = monthTxs
      .filter((t) => t.sender_id === userId)
      .reduce((a, t) => a + Number(t.amount), 0);
    const bizSpend = monthTxs
      .filter((t) => t.sender_id === userId && t.category === "business")
      .reduce((a, t) => a + Number(t.amount), 0);

    return `[Marketer context]
${budgetLine}
Total spend this month: ${s}${totalSpend.toFixed(2)}
Business/marketing spend this month: ${s}${bizSpend.toFixed(2)}`;
  }

  // copywriter, designer, hr, client_manager, lawyer — budget only
  return `[Agent context]\n${budgetLine}`;
}
