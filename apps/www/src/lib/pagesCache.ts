import { listDocuments, type FirestoreCredentials } from "@aritrips/data";

/**
 * Cache en memoria de la colección `pages` completa (2026-08-14) — mismo
 * motivo y mismo patrón que dealsCache.ts: la home, /blog y /sitemap.xml
 * leían esta colección entera cada uno por su cuenta, en cada visita, sin
 * compartir nada entre sí ni entre visitantes — 3x el costo de lectura
 * que hacía falta, sumado al mismo agotamiento de cuota que tumbó el
 * sitio (ver dealsCache.ts). Un TTL corto (2 min) alcanza — el catálogo
 * de páginas no cambia segundo a segundo.
 */
type PageDoc = Record<string, unknown> & { id: string };

let cachedPages: { pages: PageDoc[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

export async function getCachedPages(credentials: FirestoreCredentials): Promise<PageDoc[]> {
  if (cachedPages && cachedPages.expiresAt > Date.now()) return cachedPages.pages;
  const pages = (await listDocuments("pages", credentials)) as PageDoc[];
  cachedPages = { pages, expiresAt: Date.now() + CACHE_TTL_MS };
  return pages;
}
