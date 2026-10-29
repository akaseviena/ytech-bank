import type { Plan } from "@/types";

// Monthly plan prices as integer pence — the one copy. The settings page and
// /api/subscription both read this; neither keeps its own table of pounds.
// lib/money.test.mjs checks these against the price strings in PLAN_INFO.
export const PLAN_PRICE_PENCE: Record<Plan, number> = {
  basic: 0,
  standard: 490,
  travel: 990,
  metal: 1890,
  ultimate: 4490,
  business: 4000,
};
