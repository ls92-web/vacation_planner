// ===== Types for the dynamic destination search (REST Countries + GeoNames). =====

export interface GeoCountry {
  name: string; // common name, e.g. "Spain"
  official?: string;
  code: string; // ISO 3166-1 alpha-2, e.g. "ES"
  flagSvg: string; // flag image URL (svg)
  region: string; // e.g. "Europe"
  subregion?: string;
  currency?: string; // e.g. "Euro (EUR)"
  currencyCode?: string;
  languages: string[];
  capital?: string;
  capitalLatlng?: [number, number];
  latlng?: [number, number];
}

export interface GeoCity {
  name: string;
  countryCode: string;
  countryName: string;
  lat: number;
  lng: number;
  population?: number;
  admin?: string; // region / state
}

/** What we actually persist for a trip — only the user's chosen destinations. */
export interface SelectedDestination {
  id: string; // client-side id
  cityName: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
  image?: string | null;
  arrive?: string; // YYYY-MM-DD
  depart?: string; // YYYY-MM-DD
}
