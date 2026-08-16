import type { Destination, OriginHub, PriceSnapshot } from "./types";
import { weatherComfortScore, safetyScore } from "./recommend";
import { defaultMonth } from "./discover";
import { estimateTripTotalUSD } from "./priceSnapshots";

/**
 * "Ari Score" (2026-08-16, feedback del head: reemplaza el
 * popularityScore/valueRating/luxuryScore fijo — "88/100 según quién?")
 * — 3 componentes, todos trazables a un dato real que ya existía en el
 * catálogo, ninguno inventado:
 *   - value: qué tan más barato es este destino contra el resto de
 *     destinos alcanzables desde EL MISMO origen (no un umbral fijo en
 *     dólares — un vuelo desde CUN y uno desde YVR no son comparables,
 *     mismo motivo que ya llevó a que getBudgetTiers use cuartiles).
 *   - weather: la misma weatherComfortScore que ya usa el motor de
 *     recomendación real (recommend.ts) para búsquedas en vivo.
 *   - safety: el mismo safetyIndex curado desde advisories públicos.
 * Deliberadamente NO pasa por getRecommendations completo — ese motor
 * necesita presupuesto/fechas/intereses de una búsqueda real, y
 * fabricar esos 3 valores para una página estática sería cambiar un
 * número inventado por otro con más pasos.
 */
export interface AriScore {
  total: number;
  value: number;
  weather: number;
  safety: number;
}

const ARI_SCORE_WEIGHTS = { value: 0.4, weather: 0.3, safety: 0.3 };

// A pedido del usuario (2026-08-16): nunca recomendar un destino con Ari
// Score por debajo de esto — un destino caro para su propio origen, con
// clima incómodo, o con advisory de seguridad bajo no debería aparecer
// como "pick" aunque sea el menos malo del lote.
export const ARI_SCORE_MIN_RECOMMENDED = 50;

export function getAriScores(
  originAirportCode: OriginHub,
  destinations: Destination[],
  priceSnapshots: PriceSnapshot[],
  month: number = defaultMonth()
): Map<string, AriScore> {
  const candidates: { destination: Destination; totalUSD: number; weather: number; safety: number }[] = [];

  for (const destination of destinations) {
    if (destination.status !== "active") continue;
    const snapshot = priceSnapshots.find(
      (p) => p.destinationId === destination.id && p.originAirportCode === originAirportCode && p.month === month
    );
    if (!snapshot) continue;
    const season = destination.seasons.find((s) => s.months.includes(month));
    if (!season) continue;

    candidates.push({
      destination,
      totalUSD: estimateTripTotalUSD(snapshot),
      weather: weatherComfortScore(season.avgTempC),
      safety: safetyScore(destination),
    });
  }

  const scores = new Map<string, AriScore>();
  if (candidates.length === 0) return scores;

  const totals = candidates.map((c) => c.totalUSD);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);

  for (const c of candidates) {
    const value = maxTotal === minTotal ? 100 : Math.round((100 * (maxTotal - c.totalUSD)) / (maxTotal - minTotal));
    const total = Math.round(ARI_SCORE_WEIGHTS.value * value + ARI_SCORE_WEIGHTS.weather * c.weather + ARI_SCORE_WEIGHTS.safety * c.safety);
    scores.set(c.destination.id, { total, value, weather: c.weather, safety: c.safety });
  }

  return scores;
}
