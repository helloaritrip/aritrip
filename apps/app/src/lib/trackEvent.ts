/**
 * Instrumentación de los 3 eventos que define Affiliate Integration &
 * API Contracts (search_performed, recommendation_shown,
 * recommendation_clicked) — escribe de verdad a Firestore vía
 * /api/track (ver src/lib/firestore.ts para por qué REST API en vez de
 * firebase-admin). Fire-and-forget: nunca bloquea ni rompe la UI si
 * falla — un evento de analytics perdido no es un error visible para
 * el usuario.
 */
export type TrackedEvent =
  | { name: "search_performed"; originAirportCode: string; budgetUSD: number }
  | { name: "recommendation_shown"; destinationId: string; rank: number; finalScore: number }
  | {
      name: "recommendation_clicked";
      destinationId: string;
      category: "flight" | "hotel" | "activity" | "experiences" | "insurance" | "esim";
    };

export function trackEvent(event: TrackedEvent) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[track]", event);
  }
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => {
    // best-effort — sin conexión, ad blocker, etc. no debe afectar al usuario
  });
}
