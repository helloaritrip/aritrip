import { listDocuments, type FirestoreCredentials } from "@aritrips/data";

/**
 * Cache en memoria para las colecciones que leen las páginas de admin de
 * bajo tráfico (2026-08-14) — mismo patrón y mismo motivo que
 * dealsCache.ts/pagesCache.ts. Estas páginas las usa solo el dueño del
 * sitio, así que el riesgo real es mucho menor que el de /deals, pero es
 * la misma forma de bug (leer una colección entera sin cachear) y cuesta
 * poco cerrarla ahora que ya se armó el patrón. TTL corto (1 min) para
 * que "Approve"/"Flag" en Images o un cambio reciente en Prices no tarde
 * en reflejarse si el dueño refresca.
 */
type Doc = Record<string, unknown> & { id: string };

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { docs: Doc[]; expiresAt: number }>();

export async function getCachedCollection(collection: string, credentials: FirestoreCredentials): Promise<Doc[]> {
  const hit = cache.get(collection);
  if (hit && hit.expiresAt > Date.now()) return hit.docs;
  const docs = await listDocuments(collection, credentials);
  cache.set(collection, { docs, expiresAt: Date.now() + CACHE_TTL_MS });
  return docs;
}
