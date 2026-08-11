import { getDocument, type FirestoreCredentials } from "@aritrips/data";

/**
 * Switch para las columnas de anuncio reservadas (160×600) en /p/[slug] —
 * apagado por defecto históricamente estaban siempre visibles como
 * placeholder ("Ad space reserved"), y durante una revisión de AdSense
 * pendiente conviene poder ocultarlas sin deploy (2026-08-11,
 * /ari-admin/pages). Default `true` para no cambiar el comportamiento
 * actual si todavía no existe el documento en Firestore.
 */
export async function getAdRailsEnabled(credentials: FirestoreCredentials | null): Promise<boolean> {
  if (!credentials) return true;
  try {
    const doc = await getDocument("siteConfig", "ads", credentials);
    if (!doc) return true;
    return doc.railsEnabled !== false;
  } catch {
    return true;
  }
}
