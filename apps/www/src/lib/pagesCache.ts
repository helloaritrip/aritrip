import { getDocument, listDocuments, setDocument, type FirestoreCredentials } from "@aritrips/data";
import type { PageIndexEntry } from "./pagesIndex";

/**
 * Cache en memoria del índice liviano de páginas (2026-08-15, reemplaza
 * la lectura de la colección `pages` completa) — Home, /blog y
 * /sitemap.xml antes leían TODOS los docs de `pages` (incluido el JSON
 * de Puck de cada uno) en cada refresco de caché. Con 79 páginas
 * publicadas eso costaba 79 lecturas de Firestore por refresco, no 1
 * (cada documento que devuelve un `listDocuments` cuenta como una
 * lectura) — el mayor costo de lecturas del sitio con diferencia. Ahora
 * se lee `pagesIndex/current` (1 lectura), un doc mantenido por
 * pagesIndex.ts en el momento de publicar — ver ese archivo para el lado
 * de escritura.
 *
 * TTL de 20 min (igual que antes) — esta colección la actualiza un
 * humano publicando/editando a mano, no un proceso automático cada
 * minuto, así que no hace falta releerla seguido. El admin de Páginas
 * (donde SÍ importa ver el resultado al instante después de publicar)
 * sigue leyendo `pages` directo, sin este caché ni el índice — ver el
 * comentario en ari-admin/pages/index.astro.
 */
let cachedIndex: { entries: PageIndexEntry[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 20 * 60 * 1000;

export async function getCachedPageIndex(credentials: FirestoreCredentials): Promise<PageIndexEntry[]> {
  if (cachedIndex && cachedIndex.expiresAt > Date.now()) return cachedIndex.entries;

  const doc = await getDocument("pagesIndex", "current", credentials);
  if (doc && typeof doc.entriesJson === "string") {
    try {
      const entries = JSON.parse(doc.entriesJson) as PageIndexEntry[];
      cachedIndex = { entries, expiresAt: Date.now() + CACHE_TTL_MS };
      return entries;
    } catch {
      // Índice corrupto — cae al bootstrap de abajo en vez de romper.
    }
  }

  // Bootstrap: el índice todavía no existe (recién agregado, o el doc se
  // corrompió) — se arma UNA sola vez desde la colección completa (el
  // costo viejo, 79 lecturas) y se guarda, para que la próxima lectura ya
  // cueste 1 sola. A partir de acá, solo vuelve a pasar por esto si
  // `pagesIndex/current` se borra a mano.
  const allDocs = await listDocuments("pages", credentials);
  const entries: PageIndexEntry[] = allDocs
    .map((d) => ({
      id: String(d.id ?? ""),
      title: String(d.title ?? ""),
      description: String(d.description ?? ""),
      featuredImageQuery: String(d.featuredImageQuery ?? ""),
      publishedAt: typeof d.publishedAt === "string" ? d.publishedAt : undefined,
      status: String(d.status ?? "draft"),
      template: String(d.template ?? "custom"),
    }))
    .filter((e) => e.id);

  try {
    await setDocument("pagesIndex", "current", { entriesJson: JSON.stringify(entries), updatedAt: new Date() }, credentials);
  } catch {
    // Si falla el guardado no pasa nada grave — la próxima visita
    // reintenta el bootstrap con el mismo resultado.
  }

  cachedIndex = { entries, expiresAt: Date.now() + CACHE_TTL_MS };
  return entries;
}
