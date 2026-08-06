/**
 * PLACEHOLDER — no persiste nada todavía. Marca los 3 puntos de
 * instrumentación que define Affiliate Integration & API Contracts
 * (search_performed, recommendation_shown, recommendation_clicked) para
 * que quede claro dónde conectar Cloudflare Analytics / Firestore cuando
 * existan: (1) el usuario haga `firebase login` y el proyecto esté
 * linkeado, y (2) se verifique que firebase-admin corre en el runtime de
 * Cloudflare Workers (no está garantizado, es un SDK pesado). Hasta
 * entonces, loguear a consola es más honesto que un endpoint que finge
 * guardar algo.
 */
export type TrackedEvent =
  | { name: "search_performed"; originAirportCode: string; budgetUSD: number }
  | { name: "recommendation_shown"; destinationId: string; rank: number; finalScore: number }
  | { name: "recommendation_clicked"; destinationId: string; category: "flight" | "hotel" | "activity" | "insurance" | "esim" };

export function trackEvent(event: TrackedEvent) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[track:placeholder]", event);
  }
}
