import type { Destination, PriceSnapshot } from "./types";
import { originBaseCosts, destinationBaseStayCosts } from "./destinations/originBaseCosts";

const COST_TIER_MULTIPLIER: Record<"low" | "medium" | "high", number> = {
  low: 0.85,
  medium: 1.0,
  high: 1.25,
};

function seasonForMonth(destination: Destination, month: number) {
  const season = destination.seasons.find((s) => s.months.includes(month));
  if (!season) {
    throw new Error(`${destination.id}: no season covers month ${month}`);
  }
  return season;
}

/**
 * Genera los 12 PriceSnapshot (uno por mes) para un destino y un origen,
 * aplicando el multiplicador de costTier de la temporada correspondiente al
 * costo base curado a mano. Evita tipear a mano cientos de combinaciones
 * origen×mes — ver nota en types.ts sobre OriginBaseCost.
 */
export function generatePriceSnapshotsForDestination(destination: Destination): PriceSnapshot[] {
  const bases = originBaseCosts[destination.id];
  const stay = destinationBaseStayCosts[destination.id];
  if (!bases || !stay) {
    throw new Error(`Faltan costos base para el destino "${destination.id}"`);
  }

  const capturedAt = new Date().toISOString();
  const snapshots: PriceSnapshot[] = [];

  for (const base of bases) {
    for (let month = 1; month <= 12; month++) {
      const season = seasonForMonth(destination, month);
      const multiplier = COST_TIER_MULTIPLIER[season.costTier];

      snapshots.push({
        destinationId: destination.id,
        originAirportCode: base.originAirportCode,
        month,
        avgFlightCostUSD: Math.round(base.avgFlightCostUSD * multiplier),
        avgFlightDurationMinutes: base.avgFlightDurationMinutes,
        avgHotelCostPerNightUSD: {
          budget: Math.round(stay.avgHotelCostPerNightUSD.budget * multiplier),
          mid: Math.round(stay.avgHotelCostPerNightUSD.mid * multiplier),
          premium: Math.round(stay.avgHotelCostPerNightUSD.premium * multiplier),
        },
        avgActivityCostPerDayUSD: Math.round(stay.avgActivityCostPerDayUSD * multiplier),
        source: "static_seed",
        capturedAt,
      });
    }
  }

  return snapshots;
}

export function generateAllPriceSnapshots(destinations: Destination[]): PriceSnapshot[] {
  return destinations.flatMap(generatePriceSnapshotsForDestination);
}
