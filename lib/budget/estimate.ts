// ===== Estimated trip budget (per destination + trip totals). =====
// Pure, deterministic calculation so it recomputes instantly whenever travelers,
// nights, hotels, activities, or the budget level change. Users can override the
// total per destination when the estimate is off.

export type BudgetLevel = "budget" | "standard" | "luxury";

export interface BudgetBreakdown {
  hotels: number;
  activities: number;
  food: number;
  transport: number;
  total: number;
}

export interface BudgetInput {
  travelers: number;
  nights: number;
  hotels: number; // number of accommodations booked (informational)
  activities?: number; // count of planned activities; estimated from nights if omitted
  level: BudgetLevel;
  includeTransport?: boolean; // intercity transport leg (default true)
}

// Per-person / per-night reference rates in EUR.
const RATES: Record<BudgetLevel, { nightly: number; activity: number; food: number; transport: number }> = {
  budget: { nightly: 70, activity: 15, food: 25, transport: 60 },
  standard: { nightly: 140, activity: 35, food: 55, transport: 130 },
  luxury: { nightly: 320, activity: 80, food: 120, transport: 350 },
};

export const BUDGET_LEVELS: { key: BudgetLevel; label: string; hint: string }[] = [
  { key: "budget", label: "Budget", hint: "Hostels & local eats" },
  { key: "standard", label: "Standard", hint: "3–4★ hotels & a mix" },
  { key: "luxury", label: "Luxury", hint: "Premium stays & dining" },
];

export function estimatedActivities(nights: number): number {
  return Math.max(0, Math.round(Math.max(0, nights) * 1.5));
}

export function computeBudget(input: BudgetInput): BudgetBreakdown {
  const r = RATES[input.level] ?? RATES.standard;
  const travelers = Math.max(1, Math.round(input.travelers || 1));
  const nights = Math.max(0, Math.round(input.nights || 0));
  const days = nights + 1;
  const rooms = Math.max(1, Math.ceil(travelers / 2));
  const activities = input.activities ?? estimatedActivities(nights);

  const hotels = nights * r.nightly * rooms;
  const activitiesCost = activities * r.activity * travelers;
  const food = days * r.food * travelers;
  const transport = input.includeTransport === false ? 0 : r.transport * travelers;

  return {
    hotels: Math.round(hotels),
    activities: Math.round(activitiesCost),
    food: Math.round(food),
    transport: Math.round(transport),
    total: Math.round(hotels + activitiesCost + food + transport),
  };
}

export function addBreakdowns(a: BudgetBreakdown, b: BudgetBreakdown): BudgetBreakdown {
  return {
    hotels: a.hotels + b.hotels,
    activities: a.activities + b.activities,
    food: a.food + b.food,
    transport: a.transport + b.transport,
    total: a.total + b.total,
  };
}

export const EMPTY_BREAKDOWN: BudgetBreakdown = { hotels: 0, activities: 0, food: 0, transport: 0, total: 0 };

export function fmtMoney(n: number, currency = "€"): string {
  return `${currency}${Math.round(n || 0).toLocaleString("en-US")}`;
}
