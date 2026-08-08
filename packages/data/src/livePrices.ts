import type { PriceSnapshot } from "./types";
import { originBaseCosts } from "./destinations/originBaseCosts";

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
    };
  });
}
