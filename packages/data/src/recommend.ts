/**
 * Implementación de la fórmula v0 del Recommendation Engine Design.
 * Única fuente de verdad: tanto verify-golden-tests.ts como la API real
 * (apps/app/src/app/api/recommendations) importan de acá — evita que la
 * "prueba" y la "implementación real" diverjan silenciosamente.
 */
import type { Destination, InterestTag, OriginHub, PriceSnapshot, Recommendation, Season } from "./types";
import { SCORING_WEIGHTS_V1 } from "./scoringWeights";
import { estimateFlightPrice, daysUntil, type PriceEstimate } from "./priceEstimation";
import { getFlightClassPrices, type FlightClassPrices } from "./flightClassMultipliers";

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
  // Rango + confianza del precio de vuelo, ya multiplicado por la
  // cantidad de viajeros (mismo total que costBreakdown.flightUSD) —
  // motor de estimación de precios, 2026-08-10. Ver priceEstimation.ts.
  flightPriceRange: { minUSD: number; maxUSD: number; confidence: number };
  // Economic/standard/premium — 2026-08-17, ver flightClassMultipliers.ts.
  // `economic` es el mismo precio de siempre (la tarifa más barata real).
  // `standard` (premium economy) solo aparece en rutas largas (7h+),
  // donde es un producto real — en corto/medio no existe en el mercado,
  // así que no se muestra en vez de inventar un número.
  flightClassPrices: FlightClassPrices;
  // Solo presentes cuando hay un precio en vivo real para esta ruta
  // (undefined con el estimado curado) — Travelpayouts ya incluye vuelos
  // con escala, no solo directos, 2026-08-10 a pedido del usuario.
  flightTransfers?: number;
  flightAirline?: string;
  finalScore: number;
  subScores: Recommendation["subScores"];
  reasons: string[];
  rank: number;
  // Etiqueta de variedad de presupuesto (2026-08-17) — ver el comentario
  // sobre BUDGET_BAND_MAX_RATIOS más abajo para el porqué.
  dealLabel: DealLabel;
}

export type DealLabel = "Great deal" | "Best value" | "Worth the upgrade" | "Best use of your budget";

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
export function weatherComfortScore(avgTempC: { min: number; max: number }): number {
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
export function safetyScore(destination: Destination): number {
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

// "adventure" y "culture" fusionan lo que antes eran interests aparte
// ("nature" y "foodie", 2026-08-09) — no es solo un cambio de UI, el
// score también promedia ambas dimensiones curadas para que elegir
// "Adventure" siga premiando destinos fuertes en naturaleza, y "Culture"
// siga premiando destinos fuertes en comida (antes esa dimensión no
// tenía vibe score propio y quedaba en 50 neutral).
const VIBE_SCORE_BY_INTEREST: Record<InterestTag, (keyof Destination)[] | null> = {
  beach: ["beachScore"],
  adventure: ["adventureScore", "natureScore"],
  culture: ["foodScore"], // sin cultureScore curado todavia — foodScore es la señal más cercana disponible tras fusionar Food -> Culture
  nightlife: ["nightlifeScore"],
  family: ["familyScore"],
  honeymoon: ["coupleScore"],
};

function activitiesMatchScore(destination: Destination, interests: InterestTag[]): number {
  const values = interests.map((interest) => {
    const fields = VIBE_SCORE_BY_INTEREST[interest];
    if (!fields) return 50;
    const fieldValues = fields.map((field) => destination[field] as number);
    return fieldValues.reduce((a, b) => a + b, 0) / fieldValues.length;
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

// Selección con variedad real de presupuesto (2026-08-17) — a pedido del
// usuario: tomar el top-N por finalScore clusterizaba en destinos baratos.
// Causa raíz real, no solo percepción: budgetFit() da 100 a CUALQUIER
// ratio <= 0.95 (usar 20% o 90% del presupuesto puntúa igual), y
// valueRating (ver el bloque de "Value real" más arriba) normaliza
// min-max contra el resto de candidatos de ESTA búsqueda — el más barato
// del set siempre saca 100 ahí, y todo lo demás se penaliza en relación a
// él. Ninguno de los 7 sub-scores premia gastar más, así que un
// ranking puro por finalScore casi nunca deja subir del 40-50% del
// presupuesto aunque haya opciones mejores más caras. Ejemplo real
// reportado por el usuario: $3000 de presupuesto, 5 resultados, ninguno
// pasaba de 50% de uso.
//
// La regla arma 4 bandas por % de presupuesto usado (50-65/65-80/80-90/
// 90-105) y toma el mejor finalScore DENTRO de cada banda — así el
// resultado siempre cuenta una historia completa (usa poco más de la
// mitad → usa casi todo el presupuesto) en vez de 5 variaciones del
// mismo rango de precio. Piso duro en 50% (2026-08-17, ajustado a pedido
// del usuario tras ver el primer resultado — el mínimo original no tenía
// piso y seguía sintiéndose bajo): nada por debajo de 50% de uso del
// presupuesto entra al set final, ni siquiera como relleno.
const BUDGET_MIN_RATIO = 0.5;
const BUDGET_BAND_MAX_RATIOS = [0.65, 0.8, 0.9, 1.05];

function selectWithBudgetSpread(results: ScoredDestination[], budgetUSD: number, limit: number): ScoredDestination[] {
  const eligible = results.filter((r) => r.totalEstimatedCostUSD / budgetUSD >= BUDGET_MIN_RATIO);

  const selected: ScoredDestination[] = [];
  const usedIds = new Set<string>();

  let bandMin = BUDGET_MIN_RATIO - 0.0001; // epsilon para que ratio === 0.5 exacto entre en la primera banda
  for (const bandMax of BUDGET_BAND_MAX_RATIOS) {
    const best = eligible
      .filter((r) => !usedIds.has(r.destination.id))
      .filter((r) => {
        const ratio = r.totalEstimatedCostUSD / budgetUSD;
        return ratio > bandMin && ratio <= bandMax;
      })
      .sort((a, b) => b.finalScore - a.finalScore)[0];
    if (best) {
      selected.push(best);
      usedIds.add(best.destination.id);
    }
    bandMin = bandMax;
  }

  // Relleno si alguna banda quedó vacía (ej. presupuesto muy ajustado, no
  // hay ningún candidato usando 90%+) — completa con lo mejor que quede
  // disponible (siempre >= 50%, ver `eligible`) en vez de devolver menos
  // de `limit` sin necesidad. Con 4 bandas y hasta 5 resultados, el
  // relleno también es lo que naturalmente deja 2 opciones en la banda
  // con más candidatos reales cuando hace falta.
  if (selected.length < limit) {
    const remaining = eligible.filter((r) => !usedIds.has(r.destination.id)).sort((a, b) => b.finalScore - a.finalScore);
    for (const r of remaining) {
      if (selected.length >= limit) break;
      selected.push(r);
      usedIds.add(r.destination.id);
    }
  }

  selected.sort((a, b) => a.totalEstimatedCostUSD - b.totalEstimatedCostUSD);
  return selected.slice(0, limit).map((r, i, arr) => ({ ...r, rank: i + 1, dealLabel: assignDealLabel(i, arr.length) }));
}

// Etiqueta por posición relativa en el set final entregado, no por la
// banda de origen — así queda consistente incluso cuando el relleno de
// arriba tuvo que completar una banda vacía con otra opción.
function assignDealLabel(index: number, total: number): DealLabel {
  if (total <= 1) return "Best value";
  const frac = index / (total - 1);
  if (frac === 0) return "Great deal";
  if (frac === 1) return "Best use of your budget";
  if (frac >= 0.75) return "Worth the upgrade";
  return "Best value";
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

  const daysToDeparture = daysUntil(input.startDate);

  // Primera pasada: solo junta candidatos elegibles + su costo real —
  // necesaria para poder puntuar "valor" real en la segunda pasada (ver
  // abajo), no un valueRating fijo tipeado a mano sin relación con el
  // presupuesto ni el origen de ESTA búsqueda puntual.
  interface Candidate {
    destination: Destination;
    snapshot: PriceSnapshot;
    season: Season;
    costBreakdown: CostBreakdown;
    totalEstimatedCostUSD: number;
    flightPriceRange: { minUSD: number; maxUSD: number; confidence: number };
    flightClassPrices: FlightClassPrices;
    ratio: number;
  }

  const candidates: Candidate[] = [];

  for (const destination of destinations) {
    if (destination.status !== "active") continue;
    if (destination.idealTripLengthDays.min > tripDays || destination.idealTripLengthDays.max < tripDays) continue;

    const snapshot = priceSnapshots.find(
      (p) => p.destinationId === destination.id && p.originAirportCode === input.originAirportCode && p.month === month
    );
    if (!snapshot) continue;

    const season = destination.seasons.find((s) => s.months.includes(month));
    if (!season) continue;

    // Motor de estimación de precios (2026-08-10) — el snapshot ya trae
    // un precio curado/recalibrado con datos en vivo, pero ese número
    // asume implícitamente una reserva con ~60-89 días de anticipación
    // (ver priceEstimation.ts). Ajustarlo según cuán cerca está la
    // fecha real que pidió el usuario es lo que evita mostrar $220
    // cuando reservar mañana mismo cuesta $1.300 de verdad.
    const flightEstimate: PriceEstimate = estimateFlightPrice(
      snapshot.avgFlightCostUSD,
      daysToDeparture,
      snapshot.source === "provider_api"
    );

    const costBreakdown: CostBreakdown = {
      flightUSD: flightEstimate.estimatedPriceUSD * totalTravelers,
      hotelUSD: snapshot.avgHotelCostPerNightUSD.mid * tripDays * rooms,
      activitiesUSD: snapshot.avgActivityCostPerDayUSD * totalTravelers * tripDays,
    };
    const totalEstimatedCostUSD = costBreakdown.flightUSD + costBreakdown.hotelUSD + costBreakdown.activitiesUSD;
    const flightPriceRange = {
      minUSD: flightEstimate.minPriceUSD * totalTravelers,
      maxUSD: flightEstimate.maxPriceUSD * totalTravelers,
      confidence: flightEstimate.confidence,
    };
    const flightClassPrices = getFlightClassPrices(costBreakdown.flightUSD, snapshot.avgFlightDurationMinutes);

    const ratio = totalEstimatedCostUSD / input.budgetUSD;
    if (ratio > 1.05) continue;

    candidates.push({ destination, snapshot, season, costBreakdown, totalEstimatedCostUSD, flightPriceRange, flightClassPrices, ratio });
  }

  if (candidates.length === 0) return [];

  // Value real (2026-08-16, auditoría de recomendación con el usuario) —
  // reemplaza destination.valueRating (tipeado a mano, sin relación con
  // el presupuesto/origen real) por qué tan barato es ESTE destino
  // contra el resto de los que de verdad compiten en ESTA búsqueda
  // puntual — mismo criterio de min-max normalizado que ya usa
  // ariScore.ts para las páginas de contenido, ahora también en el motor
  // real. destination.valueRating sigue existiendo y se sigue usando tal
  // cual en getDiscoverPicks (el pick curado "Best value" de las hub
  // pages es una decisión editorial distinta, no una búsqueda real) — no
  // se toca ese uso.
  const costs = candidates.map((c) => c.totalEstimatedCostUSD);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);

  const results: ScoredDestination[] = [];
  const w = SCORING_WEIGHTS_V1.weights;

  for (const c of candidates) {
    const { destination, snapshot, season, costBreakdown, totalEstimatedCostUSD, flightPriceRange, flightClassPrices, ratio } = c;

    const realValueScore = maxCost === minCost ? 100 : Math.round((100 * (maxCost - totalEstimatedCostUSD)) / (maxCost - minCost));

    const subScores: Recommendation["subScores"] = {
      budgetFit: Math.round(budgetFit(ratio) * 10) / 10,
      activitiesMatch: Math.round(activitiesMatchScore(destination, input.interests) * 10) / 10,
      seasonFit: seasonFitScore(season.rainfallLevel),
      weatherComfort: weatherComfortScore(season.avgTempC),
      travelTime: travelTimeScore(snapshot.avgFlightDurationMinutes, tripDays),
      valueRating: realValueScore,
      safety: safetyScore(destination),
    };

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
      flightPriceRange,
      flightClassPrices,
      flightTransfers: snapshot.transfers,
      flightAirline: snapshot.airline,
      finalScore: Math.round(finalScore * 10) / 10,
      subScores,
      reasons: buildReasons(destination, subScores, ratio, input.interests),
      rank: 0, // se asigna abajo
      dealLabel: "Best value", // placeholder — se recalcula abajo, ver assignDealLabel
    });
  }

  return selectWithBudgetSpread(results, input.budgetUSD, limit);
}
