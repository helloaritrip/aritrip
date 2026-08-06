/**
 * Tipos fieles al documento Data Model (Sprint -1). Cualquier cambio de campo
 * acá debe reflejarse también en ese documento — son la misma fuente de verdad
 * en dos formatos (prosa para discutir, TS para compilar).
 */

/**
 * Los 16 hubs de origen aprobados para el MVP — ampliado de los 8
 * originales (2026-08-06) porque 8 resultaba muy limitado para el mercado
 * de US/CA/MX. Sigue siendo una lista curada y cerrada, no "cualquier
 * aeropuerto" — cada hub nuevo implica costos base curados a mano por
 * destino (ver destinations/originBaseCosts.ts).
 */
export const ORIGIN_HUBS = [
  "JFK",
  "MIA",
  "DFW",
  "LAX",
  "ORD",
  "YYZ",
  "YVR",
  "MEX",
  "ATL",
  "BOS",
  "SEA",
  "DEN",
  "IAH",
  "PHX",
  "SFO",
  "YUL",
] as const;
export type OriginHub = (typeof ORIGIN_HUBS)[number];

/** Mercado inicial: US/CA/MX, ver visión del producto. */
export type PassportCountry = "US" | "CA" | "MX";

export type Level = "low" | "medium" | "high";

export type InterestTag =
  | "beach"
  | "adventure"
  | "culture"
  | "nightlife"
  | "family"
  | "honeymoon"
  | "foodie"
  | "nature";

export interface Season {
  name: string;
  months: number[]; // 1-12
  avgTempC: { min: number; max: number };
  rainfallLevel: Level;
  costTier: Level;
  crowdLevel: Level;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: string;
  airportCodes: string[];
  currency: string;
  languages?: string[]; // Fase 2

  tags: InterestTag[]; // solo filtros rápidos / SEO — no alimenta el score (ver vibe scores)
  idealTripLengthDays: { min: number; max: number };
  seasons: Season[];

  // Fase 2 — opcionales hasta que exista fuente de datos confiable
  safetyIndex?: { value: number; source: string; updatedAt: string };
  internetQualityIndex?: number;
  avgDailyFoodCostUSD?: number;
  avgLocalTransportCostUSD?: number;

  visaPolicy: Record<PassportCountry, "visa_free" | "eta" | "visa_required">;

  popularityScore: number; // 0-100, curado a mano en la semilla

  // Vibe scores (0-100) — reemplazan a `tags` como fuente de Activities Match.
  // Ver Recommendation Engine Design §4b.
  valueRating: number;
  luxuryScore: number;
  familyScore: number;
  coupleScore: number;
  adventureScore: number;
  foodScore: number;
  beachScore: number;
  natureScore: number;
  nightlifeScore: number;

  // Curación (Travel Intelligence Database, Capa 1 del moat)
  idealTravelerProfile: string[];
  signatureExperiences: string[];
  insiderNotes: string;

  // Práctico
  powerPlugType: string[];
  mobileCoverageQuality: Level;
  imageQuery: string;

  status: "active" | "inactive";
}

/**
 * Costo base por destino y hub de origen, antes de aplicar el multiplicador
 * de temporada. Es lo que efectivamente se cura a mano (8 números por
 * destino) — de acá se generan los PriceSnapshot mes a mes, no al revés.
 * Ver packages/data/src/priceSnapshots.ts.
 */
export interface OriginBaseCost {
  originAirportCode: OriginHub;
  avgFlightCostUSD: number;
  avgFlightDurationMinutes: number;
}

export interface PriceSnapshot {
  destinationId: string;
  originAirportCode: OriginHub;
  month: number; // 1-12
  avgFlightCostUSD: number;
  avgFlightDurationMinutes: number;
  avgHotelCostPerNightUSD: { budget: number; mid: number; premium: number };
  avgActivityCostPerDayUSD: number;
  source: "static_seed" | "provider_api";
  capturedAt: string; // ISO date
}

export interface TripQuery {
  id?: string;
  originAirportCode: OriginHub;
  budgetUSD: number; // total del viaje, nunca por persona
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  interests: InterestTag[];
  createdAt?: string;
}

export interface Recommendation {
  id?: string;
  tripQueryId: string;
  destinationId: string;
  totalEstimatedCostUSD: number;
  subScores: {
    budgetFit: number;
    activitiesMatch: number;
    seasonFit: number;
    travelTime: number;
    valueRating: number;
  };
  finalScore: number;
  rank: number; // 1-5
  clicked: boolean;
  clickedCategory: "flight" | "hotel" | "activity" | "insurance" | "esim" | null;
  createdAt?: string;
}

export interface PartnerLink {
  provider: string;
  category: "flight" | "hotel" | "activity" | "insurance" | "esim" | "car";
  destinationId: string | null;
  urlTemplate: string;
  active: boolean;
}
