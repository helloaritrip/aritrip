/**
 * Lee los precios reales que apps/price-sync deja en Firestore —
 * `livePrices` (vuelos, un doc por ruta) y `liveHotelPrices` (hoteles,
 * un doc por destino, vía el hotel curado en packages/data/hotelKeys.ts)
 * — mismo patrón defensivo que partnerLinks.ts: cache en memoria (~1h
 * por isolate) y si Firestore falla o no hay datos, se sigue con el
 * estimado curado tal cual ya funcionaba — nunca rompe una búsqueda.
 */
import { listDocuments, type FirestoreCredentials, type LiveFlightPrice, type LiveHotelPrice } from "@aritrips/data";

type Env = { FIREBASE_CLIENT_EMAIL?: string; FIREBASE_PRIVATE_KEY?: string };

let cachedPrices: { prices: LiveFlightPrice[]; expiresAt: number } | null = null;
let cachedHotelPrices: { prices: LiveHotelPrice[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

function credentialsFrom(env: Env): FirestoreCredentials | null {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return null;
  return { clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
}

export async function getLivePrices(env: Env): Promise<LiveFlightPrice[]> {
  if (cachedPrices && cachedPrices.expiresAt > Date.now()) return cachedPrices.prices;
  const credentials = credentialsFrom(env);
  if (!credentials) return [];

  try {
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

export async function getLiveHotelPrices(env: Env): Promise<LiveHotelPrice[]> {
  if (cachedHotelPrices && cachedHotelPrices.expiresAt > Date.now()) return cachedHotelPrices.prices;
  const credentials = credentialsFrom(env);
  if (!credentials) return [];

  try {
    const docs = await listDocuments("liveHotelPrices", credentials);
    const prices: LiveHotelPrice[] = docs
      .filter((d) => typeof d.destinationId === "string" && typeof d.avgHotelCostPerNightUSD === "number")
      .map((d) => ({
        destinationId: d.destinationId as string,
        avgHotelCostPerNightUSD: d.avgHotelCostPerNightUSD as number,
        capturedAt: (d.capturedAt as string) ?? new Date().toISOString(),
      }));
    cachedHotelPrices = { prices, expiresAt: Date.now() + CACHE_TTL_MS };
    return prices;
  } catch (err) {
    console.error("[livePrices] Firestore hotel read failed, falling back to curated estimates", err);
    return [];
  }
}
