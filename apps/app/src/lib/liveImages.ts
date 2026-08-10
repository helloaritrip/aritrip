/**
 * Lee las fotos fijadas a mano desde /ari-admin/images — colección
 * `destinationImages` en Firestore, un doc por destino. Mismo patrón
 * defensivo que livePrices.ts: cache en memoria (~1h por isolate) y si
 * Firestore falla o no hay override para un destino, se sigue con la
 * búsqueda en vivo por imageQuery tal como ya funcionaba — nunca rompe
 * una búsqueda ni una card.
 */
import { listDocuments, type FirestoreCredentials, type LiveDestinationImage } from "@aritrips/data";

type Env = { FIREBASE_CLIENT_EMAIL?: string; FIREBASE_PRIVATE_KEY?: string };

let cachedImages: { images: LiveDestinationImage[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

function credentialsFrom(env: Env): FirestoreCredentials | null {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return null;
  return { clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
}

export async function getLiveImages(env: Env): Promise<LiveDestinationImage[]> {
  if (cachedImages && cachedImages.expiresAt > Date.now()) return cachedImages.images;
  const credentials = credentialsFrom(env);
  if (!credentials) return [];

  try {
    const docs = await listDocuments("destinationImages", credentials);
    const images: LiveDestinationImage[] = docs
      .filter((d) => typeof d.destinationId === "string" && typeof d.imageUrl === "string")
      .map((d) => ({ destinationId: d.destinationId as string, imageUrl: d.imageUrl as string }));
    cachedImages = { images, expiresAt: Date.now() + CACHE_TTL_MS };
    return images;
  } catch (err) {
    console.error("[liveImages] Firestore read failed, falling back to query-based images", err);
    return [];
  }
}
