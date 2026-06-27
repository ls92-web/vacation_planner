// ===== Popular destinations shown before the user searches. =====
// A small, curated set of commonly visited cities with verified coordinates.
// This is suggestion/reference data (not the user's data) — it is never stored
// in the database; only what the user actually selects is persisted.

export interface PopularDestination {
  cityName: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export const POPULAR_DESTINATIONS: PopularDestination[] = [
  { cityName: "Paris", countryName: "France", countryCode: "FR", lat: 48.8566, lng: 2.3522 },
  { cityName: "Tokyo", countryName: "Japan", countryCode: "JP", lat: 35.6762, lng: 139.6503 },
  { cityName: "Barcelona", countryName: "Spain", countryCode: "ES", lat: 41.3874, lng: 2.1686 },
  { cityName: "Rome", countryName: "Italy", countryCode: "IT", lat: 41.9028, lng: 12.4964 },
  { cityName: "Dubai", countryName: "United Arab Emirates", countryCode: "AE", lat: 25.2048, lng: 55.2708 },
  { cityName: "London", countryName: "United Kingdom", countryCode: "GB", lat: 51.5074, lng: -0.1278 },
  { cityName: "New York", countryName: "United States", countryCode: "US", lat: 40.7128, lng: -74.006 },
  { cityName: "Istanbul", countryName: "Türkiye", countryCode: "TR", lat: 41.0082, lng: 28.9784 },
  { cityName: "Bangkok", countryName: "Thailand", countryCode: "TH", lat: 13.7563, lng: 100.5018 },
  { cityName: "Marrakesh", countryName: "Morocco", countryCode: "MA", lat: 31.6295, lng: -7.9811 },
  { cityName: "Denpasar", countryName: "Indonesia", countryCode: "ID", lat: -8.6705, lng: 115.2126 },
  { cityName: "Cairo", countryName: "Egypt", countryCode: "EG", lat: 30.0444, lng: 31.2357 },
];
