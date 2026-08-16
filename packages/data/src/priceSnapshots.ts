import type { Destination, OriginHub, PriceSnapshot } from "./types";
import { originBaseCosts, destinationBaseStayCosts } from "./destinations/originBaseCosts";
import { DEFAULT_TRIP_DAYS, DEFAULT_ADULTS, defaultMonth } from "./discover";

/**
 * Un único cálculo de "cuánto sale el viaje", compartido por todo lo que
 * muestra un total (Discover, DestinationHighlight en las hub pages,
 * BudgetTierGrid) — mismo supuesto de referencia en todos lados
 * (DEFAULT_TRIP_DAYS/DEFAULT_ADULTS, ya usados por getDiscoverPicks) para
 * que el mismo destino/origen no muestre dos totales distintos en la
 * misma página según qué bloque lo calculó. Antes de esto,
 * DestinationHighlight tenía su propia cuenta de "3 noches, 1 persona"
 * separada — exactamente el tipo de número no verificable que el head
 * señaló como problema de confianza.
 */
export function estimateTripTotalUSD(snapshot: PriceSnapshot, days = DEFAULT_TRIP_DAYS, adults = DEFAULT_ADULTS): number {
  return snapshot.avgFlightCostUSD * adults + snapshot.avgHotelCostPerNightUSD.mid * days + snapshot.avgActivityCostPerDayUSD * adults * days;
}

export const COST_TIER_MULTIPLIER: Record<"low" | "medium" | "high", number> = {
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

export interface BudgetTierBucket {
  label: string;
  maxUSD: number;
  destinations: { destinationId: string; name: string; country: string; estimatedTotalUSD: number }[];
}

// "You have $X — where can you go?" (2026-08-16, feedback del head sobre
// las hub pages: agrupar por presupuesto real responde mejor la intención
// de búsqueda que una lista de "destinos populares"). Mismo filtro de
// encaje de duración que ya usa getDiscoverPicks (destinos cuyo rango
// ideal de noches cubre DEFAULT_TRIP_DAYS) y el mismo estimateTripTotalUSD
// que ya usa DestinationHighlight — un destino no puede aparecer acá con
// un total distinto al que muestra su propia card en la misma página.
//
// Cuartiles, no montos fijos ($500/$750/$1,000) — se probó con montos
// fijos primero y para CUN (uno de los orígenes más baratos del catálogo)
// 41 de 42 destinos caían en un solo bucket "$1,000+", inútil para
// comparar. El costo base varía demasiado entre los 24 hubs (un vuelo
// desde YVR/SEA no tiene nada que ver con uno desde CUN/MEX) para que un
// monto fijo tenga sentido en todos. Con cuartiles, cada hub page
// siempre muestra ~4 grupos parejos, sin importar el nivel de precio
// real de ESE origen — las etiquetas ("Under $X") se calculan de la
// distribución real, no se inventan.
const TARGET_TIER_COUNT = 4;
const NICE_ROUNDING_USD = 50;

export function getBudgetTiers(
  originAirportCode: OriginHub,
  destinations: Destination[],
  priceSnapshots: PriceSnapshot[],
  month: number = defaultMonth()
): BudgetTierBucket[] {
  const candidates: { destinationId: string; name: string; country: string; estimatedTotalUSD: number }[] = [];

  for (const destination of destinations) {
    if (destination.status !== "active") continue;
    if (destination.idealTripLengthDays.min > DEFAULT_TRIP_DAYS || destination.idealTripLengthDays.max < DEFAULT_TRIP_DAYS) {
      continue;
    }
    const snapshot = priceSnapshots.find(
      (p) => p.destinationId === destination.id && p.originAirportCode === originAirportCode && p.month === month
    );
    if (!snapshot) continue;

    candidates.push({
      destinationId: destination.id,
      name: destination.name,
      country: destination.country,
      estimatedTotalUSD: Math.round(estimateTripTotalUSD(snapshot)),
    });
  }

  if (candidates.length === 0) return [];
  candidates.sort((a, b) => a.estimatedTotalUSD - b.estimatedTotalUSD);

  const tierCount = Math.min(TARGET_TIER_COUNT, candidates.length);
  const buckets: BudgetTierBucket[] = [];
  let prevMaxUSD = 0;

  for (let i = 0; i < tierCount; i++) {
    const start = Math.floor((i * candidates.length) / tierCount);
    const end = i === tierCount - 1 ? candidates.length : Math.floor(((i + 1) * candidates.length) / tierCount);
    const slice = candidates.slice(start, end);
    if (slice.length === 0) continue;

    const isLast = i === tierCount - 1;
    const maxUSD = Math.ceil(slice[slice.length - 1].estimatedTotalUSD / NICE_ROUNDING_USD) * NICE_ROUNDING_USD;
    const label = isLast
      ? `$${prevMaxUSD.toLocaleString()}+`
      : i === 0
        ? `Under $${maxUSD.toLocaleString()}`
        : `$${prevMaxUSD.toLocaleString()}–${maxUSD.toLocaleString()}`;

    buckets.push({ label, maxUSD: isLast ? Infinity : maxUSD, destinations: slice });
    prevMaxUSD = maxUSD;
  }

  return buckets;
}
