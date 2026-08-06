/**
 * Picks para la sección "Discover" (debajo del formulario): 3 destinos
 * alcanzables desde un origen detectado, sin depender de que el usuario
 * haya llenado el formulario. Cada slot usa un campo curado distinto —
 * no hay ranking personalizado acá, es intencional (todavía no hay
 * presupuesto/fechas/intereses del usuario para eso).
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

const DEFAULT_TRIP_DAYS = 5;
const DEFAULT_ADULTS = 2;

function defaultMonth(): number {
  const now = new Date();
  const twoMonthsOut = now.getMonth() + 2; // 0-indexed + 2 => ~2 meses adelante
  return (twoMonthsOut % 12) + 1;
}

interface Candidate {
  destination: Destination;
  estimatedFromUSD: number;
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

    candidates.push({ destination, estimatedFromUSD });
  }

  const used = new Set<string>();
  const picks: DiscoverPick[] = [];

  function pickBy(slot: DiscoverSlot, field: "popularityScore" | "valueRating" | "luxuryScore") {
    const pool = candidates.filter((c) => !used.has(c.destination.id));
    if (pool.length === 0) return;
    const best = pool.reduce((a, b) => (b.destination[field] > a.destination[field] ? b : a));
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
