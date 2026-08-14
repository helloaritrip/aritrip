import { getDocument, type FirestoreCredentials } from "@aritrips/data";

/**
 * Cache en memoria (2026-08-14, auditoría post-reset de cuota) para fotos
 * fijadas a mano por destino (colección `destinationImages`, editable
 * desde /ari-admin/images). Hoy solo lo usa la card demo de la Home
 * (Cancún), pero se leía sin caché en cada visita a la página de más
 * tráfico del sitio. Mismo patrón que adminReadCache.ts (Map por clave).
 */
const cache = new Map<string, { url: string | undefined; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function getCachedDestinationImageUrl(destinationId: string, credentials: FirestoreCredentials): Promise<string | undefined> {
  const hit = cache.get(destinationId);
  if (hit && hit.expiresAt > Date.now()) return hit.url;
  try {
    const doc = await getDocument("destinationImages", destinationId, credentials);
    const url = doc && typeof doc.imageUrl === "string" ? doc.imageUrl : undefined;
    cache.set(destinationId, { url, expiresAt: Date.now() + CACHE_TTL_MS });
    return url;
  } catch {
    return undefined;
  }
}
