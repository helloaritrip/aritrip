import { getDocument, type FirestoreCredentials } from "@aritrips/data";

/**
 * Valores de layout (en px) para la sección "What can Ari find for you?"
 * de la Home — antes hardcodeados como clases arbitrarias de Tailwind
 * (pl-24, h-64, etc.), lo que significaba que cada ajuste de espaciado
 * pedido por el usuario requería que yo edite código y haga deploy. Varias
 * rondas de ida y vuelta por captura de pantalla (2026-08-10) no
 * convergían rápido, así que esto se volvió editable a mano desde
 * /ari-admin/home-layout, con vista previa en vivo — el mismo objeto de
 * config alimenta tanto el editor como la Home real.
 */
export interface DemoSectionSizes {
  mascotHeight: number;
  rowGap: number;
  cardPadLeft: number;
  photoWidth: number;
  photoHeight: number;
  cardTextPad: number;
}

export const DEMO_SIZE_DEFAULTS: DemoSectionSizes = {
  mascotHeight: 256,
  rowGap: 24,
  cardPadLeft: 128,
  photoWidth: 208,
  photoHeight: 256,
  cardTextPad: 20,
};

// Límites de seguridad — sin esto, un valor mal tipeado en el editor
// (ej. 9999) podría romper el layout de la Home para todo el mundo hasta
// el próximo ajuste.
const BOUNDS: Record<keyof DemoSectionSizes, [number, number]> = {
  mascotHeight: [80, 500],
  rowGap: [0, 200],
  cardPadLeft: [0, 400],
  photoWidth: [80, 500],
  photoHeight: [80, 500],
  cardTextPad: [0, 100],
};

export function clampHomeLayoutValue(key: keyof DemoSectionSizes, value: number): number {
  const [min, max] = BOUNDS[key];
  if (Number.isNaN(value)) return DEMO_SIZE_DEFAULTS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Las 4 secciones de la Home que se pueden reordenar entre sí (2026-08-10,
 * a pedido del usuario: "quiero un editor... que pueda mover de posición
 * las secciones"). Hero+CTA queda siempre primero y el footer siempre
 * último a propósito — no tiene sentido que el visitante entre a una
 * página sin encabezado, y son las únicas dos piezas que no compiten por
 * orden entre sí en el pedido original.
 */
export const HOME_SECTION_IDS = ["demo", "how-it-works", "blog", "trip-ideas"] as const;
export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];
export const DEFAULT_SECTION_ORDER: HomeSectionId[] = ["demo", "how-it-works", "blog", "trip-ideas"];

export interface HomeLayoutConfig extends DemoSectionSizes {
  sectionOrder: HomeSectionId[];
}

function normalizeSectionOrder(raw: unknown): HomeSectionId[] {
  if (!Array.isArray(raw)) return DEFAULT_SECTION_ORDER;
  const valid = raw.filter((id): id is HomeSectionId => (HOME_SECTION_IDS as readonly string[]).includes(id));
  // Si falta algún id (dato viejo/corrupto) o sobran duplicados, se
  // completa con el resto en el orden default en vez de fallar — nunca
  // debe desaparecer una sección de la Home por un valor guardado mal.
  const deduped = Array.from(new Set(valid));
  const missing = DEFAULT_SECTION_ORDER.filter((id) => !deduped.includes(id));
  return [...deduped, ...missing];
}

// Cache en memoria (2026-08-14, auditoría post-reset de cuota) — esta
// función se llama en CADA visita a la Home (la página de más tráfico del
// sitio) y no tenía ningún caché, a pesar de que el layout solo cambia
// cuando alguien lo edita a mano desde /ari-admin/home-layout. Mismo
// patrón y TTL que pagesCache.ts.
let cachedLayout: { config: HomeLayoutConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 20 * 60 * 1000;

export async function getHomeLayoutConfig(credentials: FirestoreCredentials | null): Promise<HomeLayoutConfig> {
  const fallback: HomeLayoutConfig = { ...DEMO_SIZE_DEFAULTS, sectionOrder: DEFAULT_SECTION_ORDER };
  if (!credentials) return fallback;
  if (cachedLayout && cachedLayout.expiresAt > Date.now()) return cachedLayout.config;
  try {
    const doc = await getDocument("siteConfig", "home", credentials);
    if (!doc) return fallback;
    const config: HomeLayoutConfig = { ...fallback };
    for (const key of Object.keys(DEMO_SIZE_DEFAULTS) as (keyof DemoSectionSizes)[]) {
      const raw = doc[key];
      if (typeof raw === "number") config[key] = clampHomeLayoutValue(key, raw);
    }
    if (typeof doc.sectionOrder === "string") {
      // Firestore (vía toFirestoreFields) solo guarda planos — un array se
      // manda como JSON serializado a mano, no como lista nativa.
      try {
        config.sectionOrder = normalizeSectionOrder(JSON.parse(doc.sectionOrder));
      } catch {
        config.sectionOrder = DEFAULT_SECTION_ORDER;
      }
    }
    cachedLayout = { config, expiresAt: Date.now() + CACHE_TTL_MS };
    return config;
  } catch {
    return fallback;
  }
}
