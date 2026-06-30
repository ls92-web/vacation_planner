// ===== Domain types for the Vacation Planner (mirrors the prototype state model) =====

export type Screen = "auth" | "dashboard" | "trips" | "form" | "explore" | "generating" | "plan" | "saved" | "profile" | "settings";
export type AuthMode = "signin" | "signup";
export type ThemeName = "Ocean" | "Sunset" | "Forest";
export type Units = "km" | "mi";
export type ExploreTab = "explore" | "saved" | "map" | "planner";
export type PlanTab = "schedule" | "map" | "chat";
export type Priority = "must" | "optional";
export type AccomType = "Hotel" | "Apartment" | "Airbnb" | "Resort" | "Other";
export type TransportMode = "Drive" | "Train" | "Flight" | "Ferry";

// ===== Per-trip traveller preferences (stored on the trip, not the account) =====
export type TravellerType = "family" | "couple" | "friends" | "solo" | "business" | "mixed";
export type TravelStyle = "relaxed" | "balanced" | "packed";

export interface TripPreferences {
  travellerType?: TravellerType;
  /** Rough head-count by life stage — drives kid/senior-aware suggestions. */
  ages?: { adults?: number; children?: number; toddlers?: number; seniors?: number };
  travelStyle?: TravelStyle;
  /** Interest keys (see PREF_INTERESTS in lib/trips/preferences). */
  interests?: string[];
  /** Accessibility/special-needs keys (see PREF_ACCESS in lib/trips/preferences). */
  accessibility?: string[];
}

export interface Accommodation {
  id: number;
  type: AccomType;
  name: string;
  checkin: string;
  checkout: string;
  /** Optional time of day for check-in / check-out, e.g. "15:00". */
  checkinTime?: string;
  checkoutTime?: string;
  conf: string;
  address: string;
  notes: string;
  /** Optional pasted link (map pin / booking) to reach this stay. */
  locationUrl?: string;
}

export interface Destination {
  id: number;
  name: string;
  country: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  image?: string | null;
  saved: boolean;
  expanded: boolean;
  arrive: string;
  depart: string;
  accoms: Accommodation[];
  /** Manual budget override (EUR). When set, replaces the estimated total. */
  budgetOverride?: number | null;
}

export interface Place {
  id: string;
  name: string;
  type: "attraction" | "restaurant";
  cats: string[];
  rating: number;
  ai: number;
  duration?: string;
  price?: string;
  avgPrice?: string;
  cuisine?: string;
  reservation?: boolean;
  hours: string;
  dist: number;
  travel: string;
  mode: "walk" | "drive";
  img: number;
  desc: string;
  why: string;
  family?: string;
  best: string;
  nearby: string[];
  tags: string[];
  x: string;
  y: string;
  closedMon?: boolean;
}

export interface SelectedPlace {
  id: string;
  priority: Priority;
}

export interface Stop {
  time: string;
  title: string;
  cat: string;
  kid: boolean;
  age: string;
  hours: string;
  duration: string;
  blurb: string;
  dist: number;
  mode: string;
  travelTime: string;
  x: string;
  y: string;
}

export interface DayPlan {
  day: string;
  date: string;
  meta: string;
  emoji: string;
  title: string;
  note: string;
  stops: Stop[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface TransportTemplate {
  duration: string;
  cost: string;
  distance: string | null;
  scenic: number | null;
  reason: string;
}
