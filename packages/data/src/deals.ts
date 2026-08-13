import type { Destination, OriginHub, PriceSnapshot } from "./types";
import type { LiveFlightPrice } from "./livePrices";

/**
 * Detección automática de "ofertas" de vuelo (2026-08-13) — investigado
 * cómo arma esto gurudeviaje.com (referencia que trajo el usuario): no
 * tienen ninguna integración técnica con Skyscanner ni ningún proveedor de
 * datos — es un equipo que busca tarifas baratas A MANO todos los días y
 * las publica como contenido ("no venden vuelos, solo las difunden desde
 * sitios confiables"). Nosotros podemos hacerlo mejor sin ese trabajo
 * manual: ya tenemos precios reales (apps/price-sync, Travelpayouts Data
 * API) Y una curva de precio curada por destino/mes como referencia de
 * "lo normal" — comparando una contra la otra se puede detectar
 * automáticamente cuándo un precio real está genuinamente barato para ESE
 * destino en ESE mes, sin que nadie tenga que mirar Skyscanner.
 *
 * `curatedSnapshots` debe venir de generateAllPriceSnapshots(destinations)
 * — es la curva "static_seed" pura, sin overlay de precios en vivo, para
 * no comparar un precio en vivo contra sí mismo.
 */
export interface FlightDeal {
  destination: Destination;
  originAirportCode: OriginHub;
  avgFlightCostUSD: number;
  expectedFlightCostUSD: number;
  discountPercent: number;
  avgFlightDurationMinutes: number;
  transfers?: number;
  airline?: string;
  travelMonth: number; // 1-12
  travelYear: number;
  capturedAt: string;
}

// Un precio real que no está al menos esto por debajo de lo normal no es
// una "oferta" honesta, es solo el precio de siempre — mismo espíritu que
// el 20% que ya se documentó como idea de producto (packages/data no lo
// tenía implementado hasta ahora).
export const MIN_DEAL_DISCOUNT_PERCENT = 12;

export function detectFlightDeals(
  livePrices: LiveFlightPrice[],
  destinations: Destination[],
  curatedSnapshots: PriceSnapshot[]
): FlightDeal[] {
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const deals: FlightDeal[] = [];

  for (const live of livePrices) {
    if (!live.searchPeriod) continue;
    const [yearStr, monthStr] = live.searchPeriod.split("-");
    const travelMonth = Number(monthStr);
    const travelYear = Number(yearStr);
    if (!travelMonth || !travelYear) continue;

    const destination = destById.get(live.destinationId);
    if (!destination || destination.status !== "active") continue;

    const curated = curatedSnapshots.find(
      (p) => p.destinationId === live.destinationId && p.originAirportCode === live.originAirportCode && p.month === travelMonth
    );
    if (!curated || curated.avgFlightCostUSD <= 0) continue;

    const discountPercent = Math.round((1 - live.avgFlightCostUSD / curated.avgFlightCostUSD) * 100);
    if (discountPercent < MIN_DEAL_DISCOUNT_PERCENT) continue;

    deals.push({
      destination,
      originAirportCode: live.originAirportCode as OriginHub,
      avgFlightCostUSD: live.avgFlightCostUSD,
      expectedFlightCostUSD: Math.round(curated.avgFlightCostUSD),
      discountPercent,
      avgFlightDurationMinutes: live.avgFlightDurationMinutes,
      transfers: live.transfers,
      airline: live.airline,
      travelMonth,
      travelYear,
      capturedAt: live.capturedAt,
    });
  }

  return deals.sort((a, b) => b.discountPercent - a.discountPercent);
}
