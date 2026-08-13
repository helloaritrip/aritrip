import { getDocument } from "@aritrips/data";

/**
 * Foto de fondo del hero de la home — editable desde /ari-admin/app-home
 * (2026-08-13, a pedido del usuario). Un solo doc en Firestore
 * (siteConfig/appHero); sin override guardado, o si Firestore falla, cae
 * al mismo criterio defensivo que el resto del proyecto: seguir andando
 * con el valor por default en vez de romper la home.
 *
 * Cache en memoria de 1h agregado 2026-08-14 (auditoría tras el
 * agotamiento de cuota de Firestore, ver apps/www/src/lib/dealsCache.ts)
 * — esta es probablemente la página de más tráfico de todo el producto
 * (la home del cotizador), y hasta ahora leía Firestore en cada visita
 * sin guardar nada. Mismo TTL que liveImages.ts (la foto cambia solo
 * cuando alguien la edita a mano desde el admin).
 */
let cachedHeroImageUrl: { url: string | null; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function getAppHeroImageUrl(env: { FIREBASE_CLIENT_EMAIL?: string; FIREBASE_PRIVATE_KEY?: string }): Promise<string | null> {
  if (cachedHeroImageUrl && cachedHeroImageUrl.expiresAt > Date.now()) return cachedHeroImageUrl.url;
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return null;

  try {
    const credentials = { clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
    const doc = await getDocument("siteConfig", "appHero", credentials);
    const url = typeof doc?.imageUrl === "string" ? doc.imageUrl : null;
    cachedHeroImageUrl = { url, expiresAt: Date.now() + CACHE_TTL_MS };
    return url;
  } catch {
    return null;
  }
}
