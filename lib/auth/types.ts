export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  country: string | null;
  onboarded: boolean;
}

export interface Preferences {
  user_id: string;
  traveler_type: string | null;
  travel_with: string | null;
  pace: string | null;
  transport: string | null;
  family_friendly: boolean;
  travelers: number | null;
  with_children: boolean;
  children_ages: string | null;
  currency: string | null;
  theme: string | null;
}

export interface SignupInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
  country?: string;
  travelStyle?: string;
  transport?: string;
  travelers?: number;
  withChildren?: boolean;
  childrenAges?: string;
}

export interface OnboardingAnswers {
  traveler_type: string;
  travel_with: string;
  pace: string;
  transport: string;
  family_friendly: boolean;
  theme: string;
}

export type AuthResult = { ok: true } | { ok: false; error: string };
/** Sign-up may need email confirmation before a session exists. */
export type SignupResult = { ok: true; needsConfirmation: boolean } | { ok: false; error: string };
