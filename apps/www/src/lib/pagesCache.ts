import { listDocuments, type FirestoreCredentials } from "@aritrips/data";

/**
 * Cache en memoria de la colección `pages` completa (2026-08-14) — mismo
 * motivo y mismo patrón que dealsCache.ts: la home, /blog y /sitemap.xml
 * leían esta colección entera cada uno por su cuenta, en cada visita, sin
 * compartir nada entre sí ni entre visitantes — 3x el costo de lectura
 * que hacía falta, sumado al mismo agotamiento de cuota que tumbó el
 * sitio (ver dealsCache.ts).
 *
 * TTL de 20 min (subido de 2 min el 2026-08-14, a pedido del usuario tras
 * preguntar por el rango ideal) — esta colección la actualiza un humano
 * publicando/editando a mano, no un proceso automático cada minuto, así
 * que no hace falta releerla seguido. 20 min es el punto medio entre "se
 * nota poco si alguien publica y no lo ve reflejado al toque en la Home/
 * blog" (nadie espera eso de un sitio de contenido) y "seguir bajando
 * lecturas de verdad" — el admin de Páginas (donde SÍ importa ver el
 * resultado al instante después de publicar) sigue deliberadamente sin
 * este caché, ver el comentario en ari-admin/pages/index.astro.
 */
type PageDoc = Record<string, unknown> & { id: string };

let cachedPages: { pages: PageDoc[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 20 * 60 * 1000;

export async function getCachedPages(credentials: FirestoreCredentials): Promise<PageDoc[]> {
  if (cachedPages && cachedPages.expiresAt > Date.now()) return cachedPages.pages;
  const pages = (await listDocuments("pages", credentials)) as PageDoc[];
  cachedPages = { pages, expiresAt: Date.now() + CACHE_TTL_MS };
  return pages;
}
