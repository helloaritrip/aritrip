/**
 * Lee los precios reales que apps/price-sync deja en Firestore (colección
 * `livePrices`, un doc por ruta origen→destino) — mismo patrón defensivo
 * que partnerLinks.ts: cache en memoria (~1h por isolate, más largo que
 * el de partners porque estos precios ya son "recientes" por diseño, no
 * hace falta refrescarlos tan seguido) y si Firestore falla o no hay
 * datos, se sigue con el estimado curado tal cual ya funcionaba — nunca
 * rompe una búsqueda de usuario.
 */
import { listDocuments, type FirestoreCredentials, type LiveFlightPrice } from "@aritrips/data";

let cachedPrices: { prices: LiveFlightPrice[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function getLivePrices(env: {
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
}): Promise<LiveFlightPrice[]> {
  if (cachedPrices && cachedPrices.expiresAt > Date.now()) return cachedPrices.prices;
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return [];

  try {
    const credentials: FirestoreCredentials = {
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
    const docs = await listDocuments("livePrices", credentials);
    const prices: LiveFlightPrice[] = docs
      .filter((d) => typeof d.destinationId === "string" && typeof d.originAirportCode === "string" && typeof d.avgFlightCostUSD === "number")
      .map((d) => ({
        destinationId: d.destinationId as string,
        originAirportCode: d.originAirportCode as string,
        avgFlightCostUSD: d.avgFlightCostUSD as number,
        avgFlightDurationMinutes: (d.avgFlightDurationMinutes as number) ?? 0,
        capturedAt: (d.capturedAt as string) ?? new Date().toISOString(),
      }));
    cachedPrices = { prices, expiresAt: Date.now() + CACHE_TTL_MS };
    return prices;
  } catch (err) {
    console.error("[livePrices] Firestore read failed, falling back to curated estimates", err);
    return [];
  }
}
