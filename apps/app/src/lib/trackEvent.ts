/**
 * Instrumentación de los 3 eventos que define Affiliate Integration &
 * API Contracts (search_performed, recommendation_shown,
 * recommendation_clicked) — escribe de verdad a Firestore vía
 * /api/track (ver src/lib/firestore.ts para por qué REST API en vez de
 * firebase-admin). Fire-and-forget: nunca bloquea ni rompe la UI si
 * falla — un evento de analytics perdido no es un error visible para
 * el usuario.
 *
 * searchId (2026-08-10, roadmap de datos post-auditoría) — un UUID
 * generado una vez por búsqueda y repetido en los 3 eventos. Sin esto
 * no hay forma de saber si un click pertenece a la búsqueda que le
 * mostró esa recomendación: son eventos sueltos, no una sesión. Con
 * searchId + el subScores/rank ya agregados abajo, "qué eligió el
 * usuario frente a lo que Ari puntuó" pasa a ser una consulta real, no
 * una aproximación agregada.
 *
 * isTest (2026-08-11) — bug real encontrado durante el arranque de Fase 2:
 * las propias pruebas de QA (Playwright) contra el sitio en producción
 * generaban búsquedas reales en la misma colección que después había que
 * contar como "1,000 búsquedas reales". Ver testMode.ts.
 */
import { isTestMode } from "./testMode";
export type SubScoresPayload = {
  budgetFit: number;
  activitiesMatch: number;
  seasonFit: number;
  weatherComfort: number;
  travelTime: number;
  valueRating: number;
  safety: number;
};

export type TrackedEvent =
  | { name: "search_performed"; searchId: string; originAirportCode: string; budgetUSD: number }
  | {
      name: "recommendation_shown";
      searchId: string;
      destinationId: string;
      rank: number;
      finalScore: number;
      subScores: SubScoresPayload;
    }
  | {
      // searchId/rank son opcionales: este mismo evento también lo dispara
      // el modal de Discover (DestinationModal), que no viene de una
      // búsqueda de Ari Core con puntaje/rank real — mejor omitirlos ahí
      // que fabricar un valor falso solo para que el tipo cierre.
      name: "recommendation_clicked";
      searchId?: string;
      destinationId: string;
      rank?: number;
      category: "flight" | "hotel" | "activity" | "insurance" | "esim";
    }
  | {
      // Último eslabón del funnel Search → Recommendation → Click →
      // Favorite → Affiliate Click (2026-08-15, roadmap acordado con el
      // head de producto) — hasta ahora SaveButton/DealSaveButton
      // guardaban el favorito de verdad pero nunca lo registraban acá,
      // así que no había forma de medir esta parte del embudo.
      // itemType/itemId espejan el modelo ya usado por /api/favorites.
      // searchId es opcional: solo existe cuando el guardado viene de una
      // card de resultados de Ari Core, no desde /deals ni Discover.
      name: "favorite_saved" | "favorite_removed";
      itemType: "destination" | "deal";
      itemId: string;
      searchId?: string;
    };

export function newSearchId(): string {
  return crypto.randomUUID();
}

export function trackEvent(event: TrackedEvent) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[track]", event);
  }
  const payload = { ...event, isTest: isTestMode() };
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // best-effort — sin conexión, ad blocker, etc. no debe afectar al usuario
  });
}
