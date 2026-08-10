/**
 * Motor de estimación de precios de vuelo (2026-08-10) — ajusta el
 * precio base ya curado/en vivo según qué tan cerca está la fecha de
 * salida, y devuelve un rango + confianza en vez de un número seco.
 *
 * Origen: el usuario comparó un precio curado de $220 (Panamá→Curaçao)
 * contra $1.109-$1.378 reales en Kiwi para una salida casi inmediata.
 * La brecha no era (solo) un bug de datos — el sistema no modelaba en
 * absoluto el efecto de reservar último momento, que en la industria
 * real es el factor de variación de precio más grande que existe.
 *
 * Alcance recortado a propósito de una propuesta más grande de 7
 * factores (anticipación, temporada, día de semana, escalas, duración,
 * cabina) — acá solo se implementa anticipación:
 *  - Temporada: ya existe un factor propio POR DESTINO (costTier en
 *    cada season, ver priceSnapshots.ts) — sumar uno global lo
 *    duplicaría y a veces lo contradiría (agosto es temporada alta en
 *    el hemisferio norte, no en destinos de esquí del sur).
 *  - Escalas / cabina / duración de itinerario: no existe ese dato en
 *    ningún lado del producto hoy — no hay selección de cabina, y no
 *    se sabe cuántas escalas va a tener el vuelo hasta que el usuario
 *    ya está en el partner. Meterlos sería simular precisión que no
 *    hay, exactamente el problema que se está tratando de resolver.
 *  - Día de semana: queda en cola — pendiente pensar bien cuánto debe
 *    pesar frente a anticipación antes de sumarlo.
 *
 * El precio base (curado, o recalibrado con datos en vivo — ver
 * livePrices.ts) se trata como si ya representara una reserva con
 * ~60-89 días de anticipación (el bucket con factor 1.00 más abajo) —
 * el "precio típico" que vería alguien que planifica con tiempo. Por
 * eso el factor se aplica directo sobre el precio base, sin necesitar
 * normalizar contra otro ancla.
 */

export interface AdvancePurchaseBucket {
  minDays: number;
  maxDays: number;
  factor: number;
}

// Heurística inicial, no reglas absolutas — un primer paso razonable
// basado en cómo se sabe que funcionan los fare buckets de las
// aerolíneas (se van cerrando a medida que se acerca la fecha).
// Centralizado acá para poder ajustar los números sin tocar la lógica
// de abajo.
export const ADVANCE_PURCHASE_FACTORS: AdvancePurchaseBucket[] = [
  { minDays: 180, maxDays: Infinity, factor: 0.8 },
  { minDays: 120, maxDays: 179, factor: 0.85 },
  { minDays: 90, maxDays: 119, factor: 0.9 },
  { minDays: 60, maxDays: 89, factor: 1.0 },
  { minDays: 30, maxDays: 59, factor: 1.1 },
  { minDays: 15, maxDays: 29, factor: 1.25 },
  { minDays: 7, maxDays: 14, factor: 1.45 },
  { minDays: 3, maxDays: 6, factor: 1.7 },
  { minDays: 0, maxDays: 2, factor: 2.0 },
];

export function advancePurchaseFactor(daysToDeparture: number): number {
  const clamped = Math.max(0, daysToDeparture);
  const bucket = ADVANCE_PURCHASE_FACTORS.find((b) => clamped >= b.minDays && clamped <= b.maxDays);
  return bucket?.factor ?? 1.0;
}

// Guardrails — sin esto, un precio base ya alto multiplicado por 2.00x
// (0-2 días) podría dar un número absurdo. Y un piso: ninguna ruta real
// cuesta menos que esto ida y vuelta.
const MAX_TOTAL_MULTIPLIER = 2.0;
const MIN_TOTAL_MULTIPLIER = 0.75;
const MIN_REASONABLE_ROUND_TRIP_USD = 40;

export interface PriceEstimate {
  estimatedPriceUSD: number;
  minPriceUSD: number;
  maxPriceUSD: number;
  confidence: number; // 0-100
}

export function computeConfidence(hasLiveData: boolean, daysToDeparture: number): number {
  let score = 40; // ruta conocida y curada — siempre cierto en nuestro catálogo
  if (hasLiveData) score += 35; // ancla real reciente, no solo un estimado a mano
  if (daysToDeparture >= 7) score += 15; // fuera de la ventana más volátil (0-6 días)
  if (daysToDeparture <= 180) score += 10; // dentro del horizonte que cubren nuestros datos
  return Math.max(10, Math.min(100, score));
}

/**
 * Ajusta un precio base (ya curado/recalibrado, ida y vuelta) según la
 * fecha de salida real que pidió el usuario, y arma un rango en vez de
 * un número seco — mismo criterio de "Estimate — confirm at booking"
 * que ya usa la UI, ahora con un número que de verdad refleja cuándo
 * quiere viajar la persona.
 */
export function estimateFlightPrice(baseRoundTripPriceUSD: number, daysToDeparture: number, hasLiveData: boolean): PriceEstimate {
  const rawFactor = advancePurchaseFactor(daysToDeparture);
  const clampedFactor = Math.max(MIN_TOTAL_MULTIPLIER, Math.min(MAX_TOTAL_MULTIPLIER, rawFactor));

  const estimatedPriceUSD = Math.max(MIN_REASONABLE_ROUND_TRIP_USD, Math.round(baseRoundTripPriceUSD * clampedFactor));

  const confidence = computeConfidence(hasLiveData, daysToDeparture);

  // El rango se agranda cuanto más último-momento es la fecha — ahí es
  // donde el precio real varía más de verdad (visto en vivo: $877-
  // $1.410 para fechas a 2-3 días de diferencia en la misma ruta) — y
  // cuanto menor es la confianza.
  const volatilityBand = daysToDeparture <= 6 ? 0.28 : daysToDeparture <= 14 ? 0.2 : daysToDeparture <= 29 ? 0.15 : 0.12;
  const confidencePenalty = ((100 - confidence) / 100) * 0.125; // hasta +12.5pp extra con confianza mínima
  const band = volatilityBand + confidencePenalty;

  const minPriceUSD = Math.max(MIN_REASONABLE_ROUND_TRIP_USD, Math.round(estimatedPriceUSD * (1 - band)));
  const maxPriceUSD = Math.round(estimatedPriceUSD * (1 + band));

  return { estimatedPriceUSD, minPriceUSD, maxPriceUSD, confidence };
}

export type PriceClassification = "GREAT_DEAL" | "GOOD_DEAL" | "FAIR" | "EXPENSIVE" | "VERY_EXPENSIVE";

/**
 * Compara un precio contra un rango esperado. NO se usa todavía sobre
 * nuestra propia estimación (compararla contra el rango que sale de
 * ella misma siempre daría "FAIR", no dice nada) — queda lista para
 * cuando haya un precio real independiente para clasificar (un precio
 * en vivo de un partner, o más adelante percentiles históricos reales,
 * ver nota de "Fase futura" abajo).
 */
export function classifyPrice(priceUSD: number, minPriceUSD: number, maxPriceUSD: number): PriceClassification {
  const mid = (minPriceUSD + maxPriceUSD) / 2;
  const range = Math.max(1, maxPriceUSD - minPriceUSD);
  const position = (priceUSD - mid) / range;

  if (position <= -0.35) return "GREAT_DEAL";
  if (position <= -0.12) return "GOOD_DEAL";
  if (position <= 0.12) return "FAIR";
  if (position <= 0.35) return "EXPENSIVE";
  return "VERY_EXPENSIVE";
}

export function daysUntil(dateISO: string): number {
  const target = new Date(`${dateISO}T00:00:00Z`).getTime();
  const now = Date.now();
  if (Number.isNaN(target)) return 60; // fecha inválida — cae al bucket neutral (factor 1.00)
  return Math.max(0, Math.round((target - now) / (1000 * 60 * 60 * 24)));
}

/**
 * Fase futura (sección 13 del documento original, no implementada
 * todavía): reemplazar baseRoundTripPriceUSD por percentiles reales
 * (P25/mediana/P75) calculados sobre el historial de precios en vivo
 * capturados por apps/price-sync una vez que haya suficiente volumen
 * acumulado — la función estimateFlightPrice no necesita cambiar de
 * forma, solo qué le pasan como "precio base".
 */
