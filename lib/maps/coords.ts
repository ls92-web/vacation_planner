import type { LatLng } from "./types";

// ===== Real coordinates for the seed Barcelona trip data. =====
// The mock catalog has no lat/lng, so these dictionaries map it onto the real map.
// User-added destinations/accommodations are geocoded at runtime instead.

export const PLACE_COORDS: Record<string, LatLng> = {
  p1: { lat: 41.4036, lng: 2.1744 }, // Sagrada Família
  p2: { lat: 41.4145, lng: 2.1527 }, // Park Güell
  p3: { lat: 41.3817, lng: 2.1717 }, // La Boqueria
  p4: { lat: 41.3916, lng: 2.1649 }, // Casa Batlló
  p5: { lat: 41.4196, lng: 2.162 }, // Bunkers del Carmel
  p6: { lat: 41.3785, lng: 2.1925 }, // Barceloneta Beach
  p7: { lat: 41.3851, lng: 2.1808 }, // Picasso Museum
  p8: { lat: 41.4111, lng: 2.132 }, // CosmoCaixa
  p9: { lat: 41.3833, lng: 2.1777 }, // Gothic Quarter
  p10: { lat: 41.4222, lng: 2.1187 }, // Tibidabo
  p11: { lat: 41.3915, lng: 2.168 }, // El Nacional
  p12: { lat: 41.3886, lng: 2.183 }, // La Paradeta
  p13: { lat: 41.3826, lng: 2.182 }, // Bo de B
  p14: { lat: 41.393, lng: 2.16 }, // Brunch & Cake
};

export const STOP_COORDS: Record<string, LatLng> = {
  "Sagrada Família": { lat: 41.4036, lng: 2.1744 },
  "Recinte Modernista Sant Pau": { lat: 41.4116, lng: 2.1745 },
  "Lunch · El Nacional": { lat: 41.3915, lng: 2.168 },
  "Park Güell": { lat: 41.4145, lng: 2.1527 },
  "Bunkers del Carmel": { lat: 41.4196, lng: 2.162 },
  "Barcelona Zoo": { lat: 41.3856, lng: 2.1869 },
  "Parc de la Ciutadella": { lat: 41.388, lng: 2.187 },
  "Lunch · La Paradeta": { lat: 41.3886, lng: 2.183 },
  "L'Aquàrium de Barcelona": { lat: 41.3766, lng: 2.1838 },
  "Barceloneta Beach": { lat: 41.3785, lng: 2.1925 },
  "Gothic Quarter walk": { lat: 41.3833, lng: 2.1777 },
  "Barcelona Cathedral": { lat: 41.3839, lng: 2.1762 },
  "Lunch · Bo de B": { lat: 41.3826, lng: 2.182 },
  "Picasso Museum": { lat: 41.3851, lng: 2.1808 },
  "CosmoCaixa Science Museum": { lat: 41.4111, lng: 2.132 },
};

export const DESTINATION_COORDS: Record<string, LatLng> = {
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  "Costa Brava": { lat: 41.9, lng: 3.16 },
};

export function placeCoords(id: string): LatLng | null {
  return PLACE_COORDS[id] ?? null;
}
export function stopCoords(title: string): LatLng | null {
  return STOP_COORDS[title] ?? null;
}
export function destinationCoords(name: string): LatLng | null {
  return DESTINATION_COORDS[name] ?? null;
}
