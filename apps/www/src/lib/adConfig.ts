import { getDocument, type FirestoreCredentials } from "@aritrips/data";

/**
 * Switch para las columnas de anuncio reservadas (160×600) en /p/[slug] —
 * apagado por defecto históricamente estaban siempre visibles como
 * placeholder ("Ad space reserved"), y durante una revisión de AdSense
 * pendiente conviene poder ocultarlas sin deploy (2026-08-11,
 * /ari-admin/pages). Default `true` para no cambiar el comportamiento
 * actual si todavía no existe el documento en Firestore.
 */
// Cache en memoria (2026-08-14, auditoría post-reset de cuota) — esto se
// llama en CADA visita a CUALQUIERA de las 72 páginas de contenido
// (/p/[slug]), sin caché, para leer un switch que un humano prende/apaga
// a mano desde el admin. Mismo patrón que dealsCache.ts/pagesCache.ts.
let cachedEnabled: { value: boolean; expiresAt: number } | null = null;
const CACHE_TTL_MS = 20 * 60 * 1000;

export async function getAdRailsEnabled(credentials: FirestoreCredentials | null): Promise<boolean> {
  if (!credentials) return true;
  if (cachedEnabled && cachedEnabled.expiresAt > Date.now()) return cachedEnabled.value;
  try {
    const doc = await getDocument("siteConfig", "ads", credentials);
    const value = !doc || doc.railsEnabled !== false;
    cachedEnabled = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    return true;
  }
}
