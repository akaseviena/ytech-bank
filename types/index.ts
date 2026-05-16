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
  balance: number;
  account_number: string;
  currency: string;
  card_frozen: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  sender_id: string | null;
  receiver_id: string | null;
  amount: number;
  description: string | null;
  category: TransactionCategory;
  type: TransactionType;
  status: TransactionStatus;
  created_at: string;
  sender?: Pick<Profile, "id" | "first_name" | "last_name" | "email" | "avatar_url">;
  receiver?: Pick<Profile, "id" | "first_name" | "last_name" | "email" | "avatar_url">;
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
    price: "€4.90/mo",
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
    price: "€9.90/mo",
    emoji: "✈️",
    features: [
      "5% cashback abroad",
      "Travel insurance",
      "€800 free ATM/mo",
      "Priority support",
    ],
  },
  metal: {
    id: "metal",
    name: "Metal",
    price: "€14.90/mo",
    features: [
      "Premium metal card",
      "Extended insurance",
      "NeuroOffice access",
    ],
  },
  ultimate: {
    id: "ultimate",
    name: "Ultimate",
    price: "€34.90/mo",
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
    price: "from €30/mo",
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
  food: { emoji: "🍔", label: "Food & Dining", color: "#FF6B6B" },
  transport: { emoji: "🚗", label: "Transport", color: "#4ECDC4" },
  entertainment: { emoji: "🎬", label: "Entertainment", color: "#A78BFA" },
  shopping: { emoji: "🛍️", label: "Shopping", color: "#F59E0B" },
  health: { emoji: "💊", label: "Health", color: "#34C759" },
  education: { emoji: "📚", label: "Education", color: "#3B82F6" },
  travel: { emoji: "✈️", label: "Travel", color: "#06B6D4" },
  business: { emoji: "💼", label: "Business", color: "#8B5CF6" },
  other: { emoji: "💳", label: "Other", color: "#6B7280" },
};
