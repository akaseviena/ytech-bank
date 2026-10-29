import type { SupabaseClient } from "@supabase/supabase-js";
import { ledgerPence, type Pence } from "@/lib/money";
import { isSubscription } from "@/lib/ledger-label";
import { CATEGORY_INFO, type LedgerItem, type LedgerLabel, type LedgerStatus, type TransactionCategory } from "@/types";

// Reads of the double-entry ledger for the web app.
//
// Two kinds of Supabase client are passed in, and the difference matters:
//   `db`    the signed-in person's own client. Row-level security limits it to
//           their account and their transfers, so every balance and history
//           read goes through this and cannot see anyone else's money.
//   `admin` service role. Used ONLY by resolveCounterparties, to turn the
//           other side's account id into a display name, and only for account
//           ids that already came back from a `db` read. Never for amounts.

/** Rails that move money without being something the person did. Shown in
 *  history with a label; excluded from sent/received totals, analytics and
 *  assistant context. They still count towards the balance. */
export const NON_FLOW_RAILS = ["promo", "migration"];

export const LABEL_TEXT: Record<LedgerLabel, string> = {
  welcome: "Welcome bonus",
  adjustment: "Balance adjustment",
  subscription: "Subscription",
};

export interface TransferRow {
  id: string;
  from_account: string;
  to_account: string;
  amount_minor: string | number; // bigint: PostgREST sends a string
  description: string | null;
  category: string;
  rail: string;
  status: LedgerStatus;
  created_at: string;
}

export interface MyAccount {
  accountId: string;
  balanceMinor: Pence;
  currency: string;
  /** public account reference, e.g. "GB62 YTEC 44758604" (accounts.iban_display) */
  ibanDisplay: string | null;
}

const TRANSFER_COLUMNS = "id,from_account,to_account,amount_minor,description,category,rail,status,created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The person's main account and its balance (account_balances is a view over the ledger). */
export async function getMyAccount(db: SupabaseClient, userId: string): Promise<MyAccount | null> {
  const { data, error } = await db
    .from("account_balances")
    .select("account_id,balance_minor,currency")
    .eq("owner_id", userId)
    .eq("kind", "main")
    .maybeSingle();
  if (error) throw new Error(`account_balances read failed: ${error.message}`);
  if (!data) return null;
  const acct = await db.from("accounts").select("iban_display").eq("id", data.account_id).maybeSingle();
  return {
    accountId: data.account_id,
    balanceMinor: ledgerPence(data.balance_minor),
    currency: data.currency,
    ibanDisplay: acct.data?.iban_display ?? null,
  };
}

export interface TransferQuery {
  limit: number;
  offset?: number;
  since?: string;
  direction?: "all" | "sent" | "received";
  category?: string;
  newestFirst?: boolean;
  /** completed transfers on rails that are real person-initiated movement */
  flowsOnly?: boolean;
}

/** Transfers touching `accountId`. Run with the person's own client. */
export async function fetchTransfers(db: SupabaseClient, accountId: string, opts: TransferQuery): Promise<TransferRow[]> {
  if (!UUID.test(accountId)) throw new Error("fetchTransfers: account id is not a uuid");
  const newestFirst = opts.newestFirst ?? true;
  const offset = opts.offset ?? 0;

  let q = db.from("transfers").select(TRANSFER_COLUMNS);
  if (opts.direction === "sent") q = q.eq("from_account", accountId);
  else if (opts.direction === "received") q = q.eq("to_account", accountId);
  else q = q.or(`from_account.eq.${accountId},to_account.eq.${accountId}`);
  if (opts.flowsOnly) q = q.eq("status", "completed").not("rail", "in", `(${NON_FLOW_RAILS.join(",")})`);
  if (opts.since) q = q.gte("created_at", opts.since);
  if (opts.category) q = q.eq("category", opts.category);

  const { data, error } = await q
    .order("created_at", { ascending: !newestFirst })
    .order("id", { ascending: !newestFirst })
    .range(offset, offset + opts.limit - 1);
  if (error) throw new Error(`transfers read failed: ${error.message}`);
  return (data ?? []) as TransferRow[];
}

// ── counterparties ──────────────────────────────────────────────────────────

interface Counterparty {
  name: string;
  avatarUrl: string | null;
  kind: string; // accounts.kind
}

const SYSTEM_NAME: Record<string, string> = {
  bank_promo: "Y-tech",
  bank_fees: "Y-tech",
  bank_settlement: "External",
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** accountId -> who it is, for the other side of each row. Service-role client. */
export async function resolveCounterparties(
  admin: SupabaseClient,
  rows: TransferRow[],
  myAccountId: string,
): Promise<Map<string, Counterparty>> {
  const otherIds = Array.from(new Set(rows.map((r) => (r.from_account === myAccountId ? r.to_account : r.from_account))));
  const accounts: { id: string; kind: string; owner_id: string | null }[] = [];
  for (const ids of chunk(otherIds, 100)) {
    const { data, error } = await admin.from("accounts").select("id,kind,owner_id").in("id", ids);
    if (error) throw new Error(`accounts lookup failed: ${error.message}`);
    accounts.push(...(data ?? []));
  }

  const ownerIds = Array.from(new Set(accounts.filter((a) => a.kind === "main" && a.owner_id).map((a) => a.owner_id as string)));
  const people = new Map<string, { first_name: string; last_name: string; avatar_url: string | null }>();
  for (const ids of chunk(ownerIds, 100)) {
    const { data, error } = await admin.from("profiles").select("id,first_name,last_name,avatar_url").in("id", ids);
    if (error) throw new Error(`profiles lookup failed: ${error.message}`);
    for (const p of data ?? []) people.set(p.id, p);
  }

  const out = new Map<string, Counterparty>();
  for (const a of accounts) {
    if (a.kind === "main") {
      const p = a.owner_id ? people.get(a.owner_id) : undefined;
      out.set(a.id, { name: p ? `${p.first_name} ${p.last_name}` : "Unknown", avatarUrl: p?.avatar_url ?? null, kind: a.kind });
    } else {
      out.set(a.id, { name: SYSTEM_NAME[a.kind] ?? "Y-tech", avatarUrl: null, kind: a.kind });
    }
  }
  return out;
}

export function toItems(rows: TransferRow[], myAccountId: string, names: Map<string, Counterparty>): LedgerItem[] {
  return rows.map((r) => {
    const sent = r.from_account === myAccountId;
    const other = names.get(sent ? r.to_account : r.from_account);
    let label: LedgerLabel | null = null;
    if (r.rail === "promo") label = "welcome";
    else if (r.rail === "migration") label = "adjustment";
    else if (isSubscription({ sent, destKind: other?.kind, rail: r.rail, category: r.category, description: r.description })) label = "subscription";
    return {
      id: r.id,
      direction: sent ? "sent" : "received",
      amountMinor: ledgerPence(r.amount_minor),
      description: r.description,
      category: r.category,
      rail: r.rail,
      status: r.status,
      createdAt: r.created_at,
      // a subscription is shown as "Subscription", without naming the system account behind it
      counterparty:
        label === "subscription"
          ? { name: LABEL_TEXT.subscription, avatarUrl: null }
          : { name: other?.name ?? "Unknown", avatarUrl: other?.avatarUrl ?? null },
      label,
    };
  });
}

// ── statistics (flows only) ────────────────────────────────────────────────

function isFlow(r: Pick<TransferRow, "rail" | "status">): boolean {
  return r.status === "completed" && !NON_FLOW_RAILS.includes(r.rail);
}

/** Sent / received / count over person-initiated, completed transfers. All integer pence. */
export function totals(rows: TransferRow[], myAccountId: string): { sent: Pence; received: Pence; count: number } {
  let sent = 0;
  let received = 0;
  let count = 0;
  for (const r of rows) {
    if (!isFlow(r)) continue;
    count++;
    const amount = ledgerPence(r.amount_minor);
    if (r.from_account === myAccountId) sent += amount;
    else received += amount;
  }
  return { sent, received, count };
}

/** Pence sent per category, flows only. */
export function spendByCategory(rows: TransferRow[], myAccountId: string): Record<string, Pence> {
  const out: Record<string, Pence> = {};
  for (const r of rows) {
    if (!isFlow(r) || r.from_account !== myAccountId) continue;
    out[r.category] = (out[r.category] ?? 0) + ledgerPence(r.amount_minor);
  }
  return out;
}

/** "🍔 food: £12.00, 🚗 transport: £3.50" — or "None". For assistant prompts. */
export function categoryLine(rows: TransferRow[], myAccountId: string, format: (p: Pence) => string): string {
  const spend = Object.entries(spendByCategory(rows, myAccountId)).sort((a, b) => b[1] - a[1]);
  if (spend.length === 0) return "None";
  return spend
    .map(([cat, pence]) => `${CATEGORY_INFO[cat as TransactionCategory]?.emoji ?? ""} ${cat}: ${format(pence)}`)
    .join(", ");
}

/** The ledger slices the two assistant routes need (flows only — see NON_FLOW_RAILS). */
export async function loadAssistantLedger(db: SupabaseClient, userId: string, twelveMonthsAgo: string) {
  const account = await getMyAccount(db, userId);
  if (!account) return { account: null, recent: [] as TransferRow[], twelveMonths: [] as TransferRow[], allTime: [] as TransferRow[] };
  const id = account.accountId;
  const [recent, twelveMonths, allTime] = await Promise.all([
    fetchTransfers(db, id, { limit: 30, flowsOnly: true }),
    fetchTransfers(db, id, { limit: 1000, flowsOnly: true, since: twelveMonthsAgo }),
    fetchTransfers(db, id, { limit: 1000, flowsOnly: true }),
  ]);
  return { account, recent, twelveMonths, allTime };
}
