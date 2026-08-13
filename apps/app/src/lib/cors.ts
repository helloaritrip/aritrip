/**
 * CORS mínimo para los pocos endpoints que la isla de "guardar favorito"
 * de apps/www (aritrips.com/deals) necesita llamar cross-origin contra
 * app.aritrips.com con cookies (`credentials: "include"`). El resto de la
 * API de apps/app no lo necesita — solo se llama desde el propio origen.
 */
const ALLOWED_ORIGINS = new Set(["https://aritrips.com", "https://www.aritrips.com", "http://localhost:4321"]);

export function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://aritrips.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
