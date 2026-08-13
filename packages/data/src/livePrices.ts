import type { PriceSnapshot } from "./types";
import { originBaseCosts, destinationBaseStayCosts } from "./destinations/originBaseCosts";

/**
 * Un precio real (recién consultado a la API de datos de Travelpayouts,
 * ver apps/price-sync) para una ruta origen→destino — un ancla actual,
 * no una cotización por mes. La API gratuita de datos no justifica 12x
 * el volumen de consultas para tener un precio por mes; en cambio, se
 * usa este ancla para RECALIBRAR la curva estacional ya curada a mano
 * (originBaseCosts + el multiplicador de temporada en priceSnapshots.ts)
 * en vez de reemplazarla — así diciembre sigue más caro que abril, solo
 * que el nivel general se ajusta a lo que la gente está pagando de
 * verdad ahora mismo. Mismo principio que ya se documentó para Fase 2 en
 * el proyecto: la base curada no se descarta, queda como capa de
 * referencia/calibración.
 */
export interface LiveFlightPrice {
  destinationId: string;
  originAirportCode: string;
  avgFlightCostUSD: number;
  avgFlightDurationMinutes: number;
  capturedAt: string; // ISO date
  transfers?: number;
  airline?: string;
  // "YYYY-MM" — el mes de viaje que apps/price-sync consultó de verdad
  // (siempre "el próximo mes" al momento del fetch, ver nextMonthPeriod()
  // en apps/price-sync). Ya se escribía en Firestore desde 2026-08-10 pero
  // nadie lo leía de vuelta hasta ahora — hace falta para deals.ts, que
  // necesita saber contra qué mes de la curva curada comparar este precio.
  searchPeriod?: string;
}

export function livePriceDocId(destinationId: string, originAirportCode: string): string {
  return `${destinationId}_${originAirportCode}`;
}

/**
 * Aplica precios reales sobre los PriceSnapshot ya generados a partir de
 * datos curados. Sin efecto si no hay precios reales para esa ruta (cae
 * de vuelta al estimado curado, tal como ya se le explica al usuario en
 * el FAQ de cada página — "estimates based on our own curated cost
 * data... not a live quote" sigue siendo honesto incluso con esto).
 */
export function applyLivePriceOverlay(snapshots: PriceSnapshot[], livePrices: LiveFlightPrice[]): PriceSnapshot[] {
  if (livePrices.length === 0) return snapshots;

  const liveByKey = new Map(livePrices.map((p) => [livePriceDocId(p.destinationId, p.originAirportCode), p]));

  return snapshots.map((snap) => {
    const live = liveByKey.get(livePriceDocId(snap.destinationId, snap.originAirportCode));
    if (!live) return snap;

    const base = originBaseCosts[snap.destinationId]?.find((b) => b.originAirportCode === snap.originAirportCode);
    if (!base || base.avgFlightCostUSD <= 0) return snap;

    const scaleFactor = live.avgFlightCostUSD / base.avgFlightCostUSD;

    return {
      ...snap,
      avgFlightCostUSD: Math.max(1, Math.round(snap.avgFlightCostUSD * scaleFactor)),
      avgFlightDurationMinutes: live.avgFlightDurationMinutes || snap.avgFlightDurationMinutes,
      source: "provider_api",
      capturedAt: live.capturedAt,
      transfers: live.transfers,
      airline: live.airline,
    };
  });
}

/**
 * Mismo principio que LiveFlightPrice, pero el ancla es uno o más hoteles
 * curados por destino (ver hotelKeys.ts — el endpoint que da el promedio
 * de toda la ciudad está roto en Xotelo), no una ruta. Un doc por
 * destinationId. `mid` siempre viene (todo destino con hotel curado tiene
 * al menos ese tier); `budget`/`premium` solo están presentes cuando ESE
 * destino ya tiene un hotel_key real de esa gama en hotelKeys.ts — la
 * mayoría del catálogo hoy solo tiene `mid` (2026-08-13, extensión
 * incremental, no cobertura completa todavía).
 */
export interface LiveHotelPrice {
  destinationId: string;
  avgHotelCostPerNightUSD: { budget?: number; mid: number; premium?: number };
  capturedAt: string; // ISO date
}

export function applyLiveHotelPriceOverlay(snapshots: PriceSnapshot[], liveHotelPrices: LiveHotelPrice[]): PriceSnapshot[] {
  if (liveHotelPrices.length === 0) return snapshots;

  const liveByDestination = new Map(liveHotelPrices.map((p) => [p.destinationId, p]));

  return snapshots.map((snap) => {
    const live = liveByDestination.get(snap.destinationId);
    if (!live) return snap;

    const base = destinationBaseStayCosts[snap.destinationId];
    if (!base || base.avgHotelCostPerNightUSD.mid <= 0) return snap;

    // Ancla de fallback para cualquier tier sin hotel_key real propio —
    // sigue el mismo nivel que ya midió `mid`, en vez de quedarse sin
    // recalibrar. Cuando un tier SÍ tiene su propio ancla real, se usa esa
    // en vez de la proporcional (más preciso).
    const midScaleFactor = live.avgHotelCostPerNightUSD.mid / base.avgHotelCostPerNightUSD.mid;

    const scaleTier = (tier: "budget" | "mid" | "premium"): number => {
      const liveTier = live.avgHotelCostPerNightUSD[tier];
      const baseTier = base.avgHotelCostPerNightUSD[tier];
      const factor = typeof liveTier === "number" && baseTier > 0 ? liveTier / baseTier : midScaleFactor;
      return Math.max(1, Math.round(snap.avgHotelCostPerNightUSD[tier] * factor));
    };

    return {
      ...snap,
      avgHotelCostPerNightUSD: {
        budget: scaleTier("budget"),
        mid: scaleTier("mid"),
        premium: scaleTier("premium"),
      },
      source: "provider_api",
      capturedAt: live.capturedAt,
    };
  });
}
