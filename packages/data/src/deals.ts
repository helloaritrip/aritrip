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
  // Curados (no verificados en vivo como el vuelo) — se suman al precio de
  // vuelo para armar las pestañas "Flight and hotel deals"/"Trip deals" en
  // /deals (2026-08-14). El vuelo sigue siendo la única señal real de
  // "esto está barato"; hotel/actividades solo describen cuánto costaría
  // el resto del viaje, mismo criterio de "estimate" que ya usa ResultCard.
  hotelPerNightUSD: number;
  activityPerDayUSD: number;
}

/**
 * Forma que se guarda en Firestore (dealsCache/current, ver
 * apps/price-sync) — igual a FlightDeal pero con `destinationId` en vez
 * del objeto `Destination` completo. Guardar el destino entero en cada
 * entrada duplicaría datos estáticos que ya vive en el bundle de las dos
 * apps (packages/data) — no hace falta repetirlos en Firestore, y el doc
 * se mantiene chico. `apps/www` reconstruye el FlightDeal completo al leer
 * (ver fromStoredFlightDeal).
 */
export type StoredFlightDeal = Omit<FlightDeal, "destination"> & { destinationId: string };

export function toStoredFlightDeal(deal: FlightDeal): StoredFlightDeal {
  const { destination, ...rest } = deal;
  return { ...rest, destinationId: destination.id };
}

export function fromStoredFlightDeal(stored: StoredFlightDeal, destinations: Destination[]): FlightDeal | null {
  const destination = destinations.find((d) => d.id === stored.destinationId);
  if (!destination || destination.status !== "active") return null;
  const { destinationId: _destinationId, ...rest } = stored;
  return { ...rest, destination };
}

// Un precio real que no está al menos esto por debajo de lo normal no es
// una "oferta" honesta, es solo el precio de siempre — mismo espíritu que
// el 20% que ya se documentó como idea de producto (packages/data no lo
// tenía implementado hasta ahora).
export const MIN_DEAL_DISCOUNT_PERCENT = 12;

/**
 * Evalúa UNA ruta puntual — no necesita conocer el resto de la colección
 * `livePrices` para decidir si esa ruta es una oferta, solo su propio
 * precio en vivo y la curva curada de ESE destino/origen/mes. Extraído
 * como función aparte (2026-08-14) para que apps/price-sync pueda
 * mantener el índice de ofertas de forma incremental (ruta por ruta, a
 * medida que ya la procesa igual) en vez de que apps/www tenga que leer
 * la colección `livePrices` completa (cientos de docs) en cada visita —
 * eso fue justo lo que agotó la cuota gratis de Firestore una vez, ver
 * apps/www/src/lib/dealsCache.ts.
 */
export function evaluateFlightDeal(
  live: LiveFlightPrice,
  destination: Destination | undefined,
  curatedSnapshots: PriceSnapshot[]
): FlightDeal | null {
  if (!live.searchPeriod) return null;
  const [yearStr, monthStr] = live.searchPeriod.split("-");
  const travelMonth = Number(monthStr);
  const travelYear = Number(yearStr);
  if (!travelMonth || !travelYear) return null;

  if (!destination || destination.status !== "active") return null;

  const curated = curatedSnapshots.find(
    (p) => p.destinationId === live.destinationId && p.originAirportCode === live.originAirportCode && p.month === travelMonth
  );
  if (!curated || curated.avgFlightCostUSD <= 0) return null;

  const discountPercent = Math.round((1 - live.avgFlightCostUSD / curated.avgFlightCostUSD) * 100);
  if (discountPercent < MIN_DEAL_DISCOUNT_PERCENT) return null;

  return {
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
    hotelPerNightUSD: Math.round(curated.avgHotelCostPerNightUSD.mid),
    activityPerDayUSD: Math.round(curated.avgActivityCostPerDayUSD),
  };
}

/**
 * Versión "todas de una" sobre evaluateFlightDeal — se mantiene para quien
 * ya tenga la colección `livePrices` completa en memoria (hoy: nadie en
 * producción, pero es una función pura útil para scripts/depuración
 * puntuales sin tener que releer Firestore).
 */
export function detectFlightDeals(
  livePrices: LiveFlightPrice[],
  destinations: Destination[],
  curatedSnapshots: PriceSnapshot[]
): FlightDeal[] {
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const deals: FlightDeal[] = [];
  for (const live of livePrices) {
    const deal = evaluateFlightDeal(live, destById.get(live.destinationId), curatedSnapshots);
    if (deal) deals.push(deal);
  }
  return deals.sort((a, b) => b.discountPercent - a.discountPercent);
}
