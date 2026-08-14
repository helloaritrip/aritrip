import { listDocuments, queryDocuments, type FirestoreCredentials } from "@aritrips/data";

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

/**
 * Mismo patrón, pero para queries ordenadas/paginadas (`queryDocuments`)
 * en vez de un `listDocuments` plano. Agregado 2026-08-15 tras encontrar
 * que /ari-admin/metrics (ex searches.astro/deals.astro) se había quedado
 * afuera del barrido de cacheo de admin de 5017e72 — leía hasta 500
 * eventos SIN cachear en cada visita/refresh, exactamente la misma forma
 * de bug que ya se había cerrado en todos los demás. TTL más largo (2 min)
 * que el resto del admin: esto es analítica histórica, no un estado que
 * el dueño necesite ver actualizado al segundo.
 */
const QUERY_CACHE_TTL_MS = 2 * 60 * 1000;
const queryCache = new Map<string, { docs: Doc[]; expiresAt: number }>();

export async function getCachedQuery(
  cacheKey: string,
  collection: string,
  credentials: FirestoreCredentials,
  options: Parameters<typeof queryDocuments>[2]
): Promise<Doc[]> {
  const hit = queryCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.docs;
  const docs = await queryDocuments(collection, credentials, options);
  queryCache.set(cacheKey, { docs, expiresAt: Date.now() + QUERY_CACHE_TTL_MS });
  return docs;
}
