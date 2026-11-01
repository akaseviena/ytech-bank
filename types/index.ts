export type Plan =
  | "basic"
  | "standard"
  | "travel"
  | "metal"
  | "ultimate"
  | "business";

export type TransactionCategory =
  | "food"
  | "transport"
  | "entertainment"
  | "shopping"
  | "health"
  | "education"
  | "travel"
  | "business"
  | "other";

export type TransactionType = "transfer" | "deposit" | "withdrawal";
export type TransactionStatus = "pending" | "completed" | "failed";
export type NotificationType = "transfer" | "system" | "promo" | "info";

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  phone: string | null;
  plan: Plan;
  account_number: string;
  currency: string;
  card_color: "yellow" | "blue";
  created_at: string;
  updated_at: string;
}

/**
 * A person you can pay, as returned by search_recipients and recent_recipients.
 * Deliberately minimal: a ledger account id, a short display name ("Anna A."),
 * the public account reference (IBAN-style) and an avatar. Nothing else about
 * another person's row is handed to the browser.
 */
export interface Recipient {
  /** the recipient's main ledger account — the p_to of post_transfer */
  account_id: string;
  display_name: string;
  account_ref: string;
  avatar_url: string | null;
}

export type LedgerStatus = "pending" | "completed" | "failed";
/** welcome = rail 'promo', adjustment = rail 'migration', subscription = paid to bank_fees. */
export type LedgerLabel = "welcome" | "adjustment" | "subscription";

/** One transfer as the signed-in person sees it. Money is integer pence. */
export interface LedgerItem {
  id: string;
  direction: "sent" | "received";
  amountMinor: number;
  description: string | null;
  category: string;
  rail: string;
  status: LedgerStatus;
  createdAt: string;
  counterparty: { name: string; avatarUrl: string | null };
  label: LedgerLabel | null;
}

/**
 * The person's card as card_get() and card_set_frozen() return it: masked, never
 * the number or the CVC. cards.status is where freezing lives ("active" | "frozen").
 */
export interface CardInfo {
  card_id: string;
  status: string;
  last4: string;
  expiry_month: number;
  expiry_year: number;
  holder_name: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  messages: ChatMessage[];
  updated_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  emoji: string;
  deadline: string | null;
  created_at: string;
}

export interface PlanInfo {
  id: Plan;
  name: string;
  price: string;
  features: string[];
  emoji?: string;
  popular?: boolean;
}

export const PLAN_INFO: Record<Plan, PlanInfo> = {
  basic: {
    id: "basic",
    name: "Basic",
    price: "Free",
    features: ["5 free transfers/mo", "1 virtual card", "Spending analytics"],
  },
  standard: {
    id: "standard",
    name: "Standard",
    price: "£4.90/mo",
    features: [
      "Unlimited transfers",
      "Physical + virtual card",
      "3% cashback",
      "Savings pockets",
    ],
  },
  travel: {
    id: "travel",
    name: "Travel",
    price: "£9.90/mo",
    emoji: "✈️",
    features: [
      "5% cashback abroad",
      "Travel insurance",
      "£800 free ATM/mo",
      "Priority support",
    ],
  },
  metal: {
    id: "metal",
    name: "Metal",
    price: "£18.90/mo",
    features: [
      "Premium metal card",
      "Extended insurance",
      "NeuroOffice access",
    ],
  },
  ultimate: {
    id: "ultimate",
    name: "Ultimate",
    price: "£44.90/mo",
    emoji: "👑",
    popular: true,
    features: [
      "Concierge service",
      "Personal account manager",
      "Unlimited transfers & ATM",
      "Full NeuroOffice + VIP events",
      "Premium health insurance",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: "from £40/mo",
    features: [
      "10 corporate cards",
      "Full NeuroOffice AI",
      "API integration",
      "Auto accounting",
    ],
  },
};

// ─── NeuroOffice ──────────────────────────────────────
export type AgentType =
  | "marketer"
  | "copywriter"
  | "hr-manager"
  | "client-manager"
  | "consultant"
  | "designer"
  | "lawyer"
  | "accountant";

export interface AgentInfo {
  id: AgentType;
  emoji: string;
  name: string;
  description: string;
  route: string;
}

export const AGENTS: AgentInfo[] = [
  { id: "marketer",       emoji: "📢", name: "Marketer",       description: "Content plans, ad campaigns, and creative ideas",          route: "/neurooffice/marketer" },
  { id: "copywriter",     emoji: "✍️", name: "Copywriter",     description: "Professional texts, SEO optimization, translations",       route: "/neurooffice/copywriter" },
  { id: "hr-manager",     emoji: "👥", name: "HR Manager",     description: "Job postings, interview questions, employee assessment",    route: "/neurooffice/hr-manager" },
  { id: "client-manager", emoji: "🤝", name: "Client Manager", description: "Customer responses, sales scripts, objection handling",     route: "/neurooffice/client-manager" },
  { id: "consultant",     emoji: "💡", name: "Consultant",     description: "Business optimization, market analysis, growth ideas",      route: "/neurooffice/consultant" },
  { id: "designer",       emoji: "🎨", name: "Designer",       description: "Design briefs, brand guidelines, creative direction",       route: "/neurooffice/designer" },
  { id: "lawyer",         emoji: "⚖️", name: "Lawyer",         description: "Contract templates, risk analysis, legal guidance",         route: "/neurooffice/lawyer" },
  { id: "accountant",     emoji: "🧾", name: "Accountant",     description: "Tax planning, financial reports, cost optimization",        route: "/neurooffice/accountant" },
];

const ALL_AGENTS: AgentType[] = ["marketer", "copywriter", "hr-manager", "client-manager", "consultant", "designer", "lawyer", "accountant"];

export const AGENT_PLAN_ACCESS: Partial<Record<Plan, AgentType[]>> = {
  metal:    ["marketer", "copywriter", "consultant"],
  ultimate: ALL_AGENTS,
  business: ALL_AGENTS,
};

export const NEUROOFFICE_PLANS: Plan[] = ["metal", "ultimate", "business"];

export const CATEGORY_INFO: Record<
  TransactionCategory,
  { emoji: string; label: string; color: string }
> = {
  food:          { emoji: "🍔", label: "Food & Dining", color: "#FFD60A" },
  transport:     { emoji: "🚗", label: "Transport",     color: "#0A84FF" },
  entertainment: { emoji: "🎬", label: "Entertainment", color: "#FF375F" },
  shopping:      { emoji: "🛍️", label: "Shopping",      color: "#30D158" },
  health:        { emoji: "💊", label: "Health",         color: "#FF2D55" },
  education:     { emoji: "📚", label: "Education",      color: "#64D2FF" },
  travel:        { emoji: "✈️", label: "Travel",          color: "#5E5CE6" },
  business:      { emoji: "💼", label: "Business",       color: "#BF5AF2" },
  other:         { emoji: "💳", label: "Other",           color: "#FF9F0A" },
};
