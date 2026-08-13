import { getDocument } from "@aritrips/data";

/**
 * Foto de fondo del hero de la home — editable desde /ari-admin/app-home
 * (2026-08-13, a pedido del usuario). Un solo doc en Firestore
 * (siteConfig/appHero); sin override guardado, o si Firestore falla, cae
 * al mismo criterio defensivo que el resto del proyecto: seguir andando
 * con el valor por default en vez de romper la home.
 */
export async function getAppHeroImageUrl(env: { FIREBASE_CLIENT_EMAIL?: string; FIREBASE_PRIVATE_KEY?: string }): Promise<string | null> {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return null;
  try {
    const credentials = { clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
    const doc = await getDocument("siteConfig", "appHero", credentials);
    return typeof doc?.imageUrl === "string" ? doc.imageUrl : null;
  } catch {
    return null;
  }
}
