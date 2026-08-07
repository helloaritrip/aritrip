/**
 * Picks para la sección "Discover" (debajo del formulario): 3 destinos
 * alcanzables desde un origen detectado, sin depender de que el usuario
 * haya llenado el formulario. Cada slot arranca de un campo curado distinto
 * (popularityScore / valueRating / luxuryScore) — sigue sin ser
 * personalización real (no hay presupuesto/fechas/intereses del usuario acá
 * todavía), pero cada campo se mezcla con qué tan accesible es ESE destino
 * específicamente desde el origen detectado (ver `accessibility` más abajo).
 *
 * Antes el pick era 100% el campo absoluto — con pocos destinos, "mejor
 * valor" y "viaje soñado" mostraban siempre el mismo ganador global sin
 * importar desde dónde te conectabas (bug conocido, documentado desde
 * Sprint 2). Con 40 destinos y 24 hubs ya vale la pena resolverlo de
 * verdad: mismo campo curado, pero el ganador ahora puede cambiar según el
 * origen porque la accesibilidad (costo de vuelo relativo al resto del
 * pool de ESE origen) entra en el mismo score.
 */
import type { Destination, OriginHub, PriceSnapshot } from "./types";

export type DiscoverSlot = "popular" | "recommended" | "dream";

export interface DiscoverPick {
  slot: DiscoverSlot;
  destinationId: string;
  name: string;
  country: string;
  estimatedFromUSD: number;
  imageQuery: string;
}

export const DEFAULT_TRIP_DAYS = 5;
export const DEFAULT_ADULTS = 2;

// Cuánto pesa la accesibilidad desde el origen frente al campo curado
// absoluto — se mantiene minoritario a propósito, para que "recomendado"
// siga leyendo como "buen valor" y no colapse en "lo más cercano".
const ACCESSIBILITY_WEIGHT = 0.35;

export function defaultMonth(): number {
  const now = new Date();
  const twoMonthsOut = now.getMonth() + 2; // 0-indexed + 2 => ~2 meses adelante
  return (twoMonthsOut % 12) + 1;
}

interface Candidate {
  destination: Destination;
  estimatedFromUSD: number;
  avgFlightCostUSD: number;
}

export function getDiscoverPicks(
  originAirportCode: OriginHub,
  destinations: Destination[],
  priceSnapshots: PriceSnapshot[],
  month: number = defaultMonth()
): DiscoverPick[] {
  const candidates: Candidate[] = [];

  for (const destination of destinations) {
    if (destination.status !== "active") continue;
    if (destination.idealTripLengthDays.min > DEFAULT_TRIP_DAYS || destination.idealTripLengthDays.max < DEFAULT_TRIP_DAYS) {
      continue;
    }
    const snapshot = priceSnapshots.find(
      (p) => p.destinationId === destination.id && p.originAirportCode === originAirportCode && p.month === month
    );
    if (!snapshot) continue;

    const estimatedFromUSD =
      snapshot.avgFlightCostUSD * DEFAULT_ADULTS +
      snapshot.avgHotelCostPerNightUSD.mid * DEFAULT_TRIP_DAYS +
      snapshot.avgActivityCostPerDayUSD * DEFAULT_ADULTS * DEFAULT_TRIP_DAYS;

    candidates.push({ destination, estimatedFromUSD, avgFlightCostUSD: snapshot.avgFlightCostUSD });
  }

  const used = new Set<string>();
  const picks: DiscoverPick[] = [];

  function pickBy(slot: DiscoverSlot, field: "popularityScore" | "valueRating" | "luxuryScore") {
    const pool = candidates.filter((c) => !used.has(c.destination.id));
    if (pool.length === 0) return;

    // Accesibilidad relativa al pool de ESTE origen: vuelo más barato entre
    // los candidatos disponibles = 100, más caro = 0. Recalculado por
    // llamada, por eso el resultado varía con el origen aunque el campo
    // curado sea el mismo destino en todo el catálogo.
    const flightCosts = pool.map((c) => c.avgFlightCostUSD);
    const minCost = Math.min(...flightCosts);
    const maxCost = Math.max(...flightCosts);
    const accessibility = (c: Candidate) => (maxCost === minCost ? 100 : (100 * (maxCost - c.avgFlightCostUSD)) / (maxCost - minCost));

    const scored = pool.map((c) => ({
      candidate: c,
      score: c.destination[field] * (1 - ACCESSIBILITY_WEIGHT) + accessibility(c) * ACCESSIBILITY_WEIGHT,
    }));
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a)).candidate;

    used.add(best.destination.id);
    picks.push({
      slot,
      destinationId: best.destination.id,
      name: best.destination.name,
      country: best.destination.country,
      estimatedFromUSD: Math.round(best.estimatedFromUSD),
      imageQuery: best.destination.imageQuery,
    });
  }

  pickBy("popular", "popularityScore");
  pickBy("recommended", "valueRating");
  pickBy("dream", "luxuryScore");

  return picks;
}

export interface DiscoverDetail {
  destinationId: string;
  destinationAirportCode: string;
  name: string;
  country: string;
  imageQuery: string;
  tripDays: number;
  adults: number;
  startDate: string; // ISO yyyy-mm-dd, misma fecha de referencia usada para el clima/precio
  endDate: string;
  totalEstimatedCostUSD: number;
  costBreakdown: { flightUSD: number; hotelUSD: number; activitiesUSD: number };
  weather: { avgTempMinC: number; avgTempMaxC: number; rainfallLevel: "low" | "medium" | "high" } | null;
  signatureExperiences: string[];
  insiderNotes: string;
}

// Mismo desfase de "~2 meses adelante" que defaultMonth(), pero devuelve
// fechas reales (con año) para poder armar links de reserva — defaultMonth()
// solo da el número de mes porque es lo único que necesita el matching
// contra PriceSnapshot.month.
function defaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 2, 15);
  const end = new Date(start);
  end.setDate(end.getDate() + DEFAULT_TRIP_DAYS);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

/**
 * Detalle completo para UNA card de Discover cuando el usuario hace clic
 * — no pasa por el motor de recomendación (`getRecommendations`) porque
 * ese necesita presupuesto/intereses que todavía no existen en este punto
 * del flujo (el usuario no llenó el formulario). Usa los mismos supuestos
 * por default que ya calculaban `estimatedFromUSD` en los picks (5
 * noches, 2 adultos, ~2 meses adelante) para que el precio mostrado acá
 * coincida exacto con el de la card. Los "highlights" son la ficha
 * curada real del destino (signatureExperiences/insiderNotes), no
 * "reasons" algorítmicas — no hay intereses del usuario con qué
 * calcularlas todavía.
 */
export function getDiscoverDetail(
  destinationId: string,
  originAirportCode: OriginHub,
  destinations: Destination[],
  priceSnapshots: PriceSnapshot[],
  month: number = defaultMonth()
): DiscoverDetail | null {
  const destination = destinations.find((d) => d.id === destinationId && d.status === "active");
  if (!destination) return null;

  const snapshot = priceSnapshots.find(
    (p) => p.destinationId === destinationId && p.originAirportCode === originAirportCode && p.month === month
  );
  if (!snapshot) return null;

  const costBreakdown = {
    flightUSD: Math.round(snapshot.avgFlightCostUSD * DEFAULT_ADULTS),
    hotelUSD: Math.round(snapshot.avgHotelCostPerNightUSD.mid * DEFAULT_TRIP_DAYS),
    activitiesUSD: Math.round(snapshot.avgActivityCostPerDayUSD * DEFAULT_ADULTS * DEFAULT_TRIP_DAYS),
  };

  const season = destination.seasons.find((s) => s.months.includes(month));
  const { startDate, endDate } = defaultDateRange();

  return {
    destinationId: destination.id,
    destinationAirportCode: destination.airportCodes[0],
    name: destination.name,
    country: destination.country,
    imageQuery: destination.imageQuery,
    tripDays: DEFAULT_TRIP_DAYS,
    adults: DEFAULT_ADULTS,
    startDate,
    endDate,
    totalEstimatedCostUSD: costBreakdown.flightUSD + costBreakdown.hotelUSD + costBreakdown.activitiesUSD,
    costBreakdown,
    weather: season
      ? { avgTempMinC: season.avgTempC.min, avgTempMaxC: season.avgTempC.max, rainfallLevel: season.rainfallLevel }
      : null,
    signatureExperiences: destination.signatureExperiences,
    insiderNotes: destination.insiderNotes,
  };
}
