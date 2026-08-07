/**
 * Implementación de la fórmula v0 del Recommendation Engine Design.
 * Única fuente de verdad: tanto verify-golden-tests.ts como la API real
 * (apps/app/src/app/api/recommendations) importan de acá — evita que la
 * "prueba" y la "implementación real" diverjan silenciosamente.
 */
import type { Destination, InterestTag, OriginHub, PriceSnapshot, Recommendation } from "./types";
import { SCORING_WEIGHTS_V1 } from "./scoringWeights";

export interface RecommendationInput {
  originAirportCode: OriginHub;
  budgetUSD: number;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  adults: number;
  children: number;
  interests: InterestTag[];
}

export interface CostBreakdown {
  flightUSD: number;
  hotelUSD: number;
  activitiesUSD: number;
}

export interface ScoredDestination {
  destination: Destination;
  totalEstimatedCostUSD: number;
  costBreakdown: CostBreakdown;
  finalScore: number;
  subScores: Recommendation["subScores"];
  reasons: string[];
  rank: number;
}

function budgetFit(ratio: number): number {
  if (ratio > 1.0) return Math.max(0, 100 - (ratio - 1.0) * 400);
  if (ratio >= 0.95) return 100 - ((ratio - 0.95) / 0.05) * 10;
  return 100;
}

function seasonFitScore(rainfallLevel: "low" | "medium" | "high"): number {
  return { low: 100, medium: 85, high: 65 }[rainfallLevel];
}

// Confort de temperatura durante el viaje — deliberadamente NO mira lluvia,
// para no contar la misma señal dos veces (rainfallLevel ya pesa en Season
// Fit). Banda ideal 20-28°C sobre el punto medio de la temporada; penaliza
// por grado de distancia hacia cualquiera de los dos extremos.
function weatherComfortScore(avgTempC: { min: number; max: number }): number {
  const mid = (avgTempC.min + avgTempC.max) / 2;
  const IDEAL_LOW = 20;
  const IDEAL_HIGH = 28;
  if (mid >= IDEAL_LOW && mid <= IDEAL_HIGH) return 100;
  const distance = mid < IDEAL_LOW ? IDEAL_LOW - mid : mid - IDEAL_HIGH;
  return Math.max(30, Math.round(100 - distance * 6));
}

// safetyIndex.value viene curado a mano desde advisories públicos (ver
// destinations/index.ts). Fallback neutral solo por robustez de tipos —
// los 40 destinos activos ya lo tienen curado.
function safetyScore(destination: Destination): number {
  return destination.safetyIndex?.value ?? 70;
}

function travelTimeScore(durationMin: number, tripDays: number): number {
  let base: number;
  if (durationMin < 150) base = 100;
  else if (durationMin < 250) base = 90;
  else if (durationMin < 350) base = 75;
  else if (durationMin < 450) base = 55;
  else base = 35;
  if (tripDays <= 4 && durationMin > 240) base -= 20;
  return Math.max(0, base);
}

const VIBE_SCORE_BY_INTEREST: Record<InterestTag, keyof Destination | null> = {
  beach: "beachScore",
  adventure: "adventureScore",
  culture: null, // sin vibe score curado todavia — ver backlog del catalogo
  nightlife: "nightlifeScore",
  family: "familyScore",
  honeymoon: "coupleScore",
  foodie: "foodScore",
  nature: "natureScore",
};

function activitiesMatchScore(destination: Destination, interests: InterestTag[]): number {
  const values = interests.map((interest) => {
    const field = VIBE_SCORE_BY_INTEREST[interest];
    return field ? (destination[field] as number) : 50;
  });
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function tripDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function buildReasons(
  destination: Destination,
  subScores: Recommendation["subScores"],
  ratio: number,
  interests: InterestTag[]
): string[] {
  const candidates: { text: string; weight: number }[] = [
    {
      text:
        ratio <= 0.95
          ? `Uses ${Math.round(ratio * 100)}% of your budget, with room to spare`
          : `Fits your budget (${Math.round(ratio * 100)}% used)`,
      weight: subScores.budgetFit,
    },
    {
      text: `Matches what you're looking for: ${interests.join(", ")}`,
      weight: subScores.activitiesMatch,
    },
    {
      text: subScores.seasonFit >= 85 ? "Great weather for your travel dates" : "Decent weather for your travel dates",
      weight: subScores.seasonFit,
    },
    {
      text: subScores.travelTime >= 75 ? "Short, easy flight from your origin" : "A longer flight, but worth it",
      weight: subScores.travelTime,
    },
    {
      text: `Rated as ${destination.valueRating >= 75 ? "excellent" : "good"} overall value`,
      weight: subScores.valueRating,
    },
    {
      text: subScores.weatherComfort >= 85 ? "Comfortable temperatures for your trip" : "Weather is manageable, if not ideal",
      weight: subScores.weatherComfort,
    },
    {
      text: subScores.safety >= 85 ? "Rated as a very safe destination" : "Generally safe — standard travel precautions apply",
      weight: subScores.safety,
    },
  ];
  return candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((c) => c.text);
}

export function getRecommendations(
  input: RecommendationInput,
  destinations: Destination[],
  priceSnapshots: PriceSnapshot[],
  limit = 5
): ScoredDestination[] {
  const tripDays = tripDaysBetween(input.startDate, input.endDate);
  const month = new Date(input.startDate).getMonth() + 1;
  const rooms = Math.ceil(input.adults / 2);
  const totalTravelers = input.adults + input.children;

  const results: ScoredDestination[] = [];

  for (const destination of destinations) {
    if (destination.status !== "active") continue;
    if (destination.idealTripLengthDays.min > tripDays || destination.idealTripLengthDays.max < tripDays) continue;

    const snapshot = priceSnapshots.find(
      (p) => p.destinationId === destination.id && p.originAirportCode === input.originAirportCode && p.month === month
    );
    if (!snapshot) continue;

    const costBreakdown: CostBreakdown = {
      flightUSD: snapshot.avgFlightCostUSD * totalTravelers,
      hotelUSD: snapshot.avgHotelCostPerNightUSD.mid * tripDays * rooms,
      activitiesUSD: snapshot.avgActivityCostPerDayUSD * totalTravelers * tripDays,
    };
    const totalEstimatedCostUSD = costBreakdown.flightUSD + costBreakdown.hotelUSD + costBreakdown.activitiesUSD;

    const ratio = totalEstimatedCostUSD / input.budgetUSD;
    if (ratio > 1.05) continue;

    const season = destination.seasons.find((s) => s.months.includes(month));
    if (!season) continue;

    const subScores: Recommendation["subScores"] = {
      budgetFit: Math.round(budgetFit(ratio) * 10) / 10,
      activitiesMatch: Math.round(activitiesMatchScore(destination, input.interests) * 10) / 10,
      seasonFit: seasonFitScore(season.rainfallLevel),
      weatherComfort: weatherComfortScore(season.avgTempC),
      travelTime: travelTimeScore(snapshot.avgFlightDurationMinutes, tripDays),
      valueRating: destination.valueRating,
      safety: safetyScore(destination),
    };

    const w = SCORING_WEIGHTS_V1.weights;
    const finalScore =
      w.budgetFit * subScores.budgetFit +
      w.activitiesMatch * subScores.activitiesMatch +
      w.valueRating * subScores.valueRating +
      w.seasonFit * subScores.seasonFit +
      w.weatherComfort * subScores.weatherComfort +
      w.travelTime * subScores.travelTime +
      w.safety * subScores.safety;

    results.push({
      destination,
      totalEstimatedCostUSD,
      costBreakdown,
      finalScore: Math.round(finalScore * 10) / 10,
      subScores,
      reasons: buildReasons(destination, subScores, ratio, input.interests),
      rank: 0, // se asigna abajo, tras ordenar
    });
  }

  results.sort((a, b) => b.finalScore - a.finalScore);
  return results.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}
