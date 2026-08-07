/**
 * Pesos del Scoring Engine — versionados a propósito (ver "Ari Core v1",
 * documento de arquitectura). Nunca hardcodear un peso dentro de
 * recommend.ts: cualquier recalibración futura (manual, y más adelante
 * quizás vía bandits) crea una V2 acá en vez de tocar la fórmula.
 */
export const SCORING_WEIGHTS_V1 = {
  version: "v1",
  weights: {
    budgetFit: 0.2,
    activitiesMatch: 0.18,
    valueRating: 0.16,
    seasonFit: 0.14,
    weatherComfort: 0.12,
    travelTime: 0.12,
    safety: 0.08,
  },
} as const;
