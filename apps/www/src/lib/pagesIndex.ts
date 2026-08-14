import { getDocument, setDocument, type FirestoreCredentials } from "@aritrips/data";

/**
 * Versión liviana de un doc de `pages` — solo los campos que necesitan
 * Home/blog/sitemap para listar, sin `contentJson` (el JSON de Puck,
 * pesado y nunca usado por esas 3 páginas).
 */
export interface PageIndexEntry {
  id: string;
  title: string;
  description: string;
  featuredImageQuery: string;
  publishedAt?: string;
  status: string;
  template: string;
}

const PAGES_INDEX_DOC = "current";

/**
 * Mantiene `pagesIndex/current` — un solo doc con todas las entradas
 * livianas — actualizado en el momento de publicar/republicar
 * (2026-08-15, auditoría de lecturas). Antes, Home/blog/sitemap leían la
 * colección `pages` COMPLETA en cada refresco de caché: con 79 páginas
 * publicadas, eso son 79 lecturas de Firestore por refresco (cada
 * documento que devuelve un `listDocuments` cuenta como 1 lectura), no 1
 * — ~7,000 lecturas/día solo por esto con tráfico normal. Igual que
 * `dealsCache/current` en apps/price-sync: el costo de armar el índice se
 * paga una vez por publicación (acción humana, rara), no una vez por
 * visita. Ver pagesCache.ts para el lado de lectura.
 */
export async function upsertPageIndexEntries(credentials: FirestoreCredentials, entries: PageIndexEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const existing = await getDocument("pagesIndex", PAGES_INDEX_DOC, credentials);
  const stored: PageIndexEntry[] = (() => {
    if (typeof existing?.entriesJson !== "string") return [];
    try {
      return JSON.parse(existing.entriesJson) as PageIndexEntry[];
    } catch {
      return [];
    }
  })();

  const byId = new Map(stored.map((e) => [e.id, e]));
  for (const entry of entries) byId.set(entry.id, entry);

  await setDocument(
    "pagesIndex",
    PAGES_INDEX_DOC,
    { entriesJson: JSON.stringify([...byId.values()]), updatedAt: new Date() },
    credentials
  );
}
