import { getDocument, type FirestoreCredentials } from "@aritrips/data";

/**
 * Contenido editable de la card de ejemplo "What can Ari find for you?" de
 * la Home (2026-08-19) — reemplaza el sistema de tamaños/espaciado
 * editables (DemoSectionSizes, /ari-admin/home-layout con sliders) que el
 * usuario pidió sacar por no necesitarlo más ("nunca va a variar"). Lo que
 * SÍ quiso poder editar sin deploy es el destino de ejemplo y el texto de
 * la oferta — mismo principio que llevó a construir el editor de tamaños
 * en primer lugar (2026-08-10), aplicado a lo que de verdad hace falta
 * ahora. `destinationId` maneja tanto el nombre como la foto (vía
 * destinationImages/imageQuery del catálogo, ver index.astro) — el resto
 * son campos de texto/número libres.
 */
export interface DemoTripContent {
  destinationId: string;
  flag: string;
  budgetLabel: string;
  total: number;
  flight: number;
  hotel: number;
  activities: number;
}

export const DEFAULT_DEMO_TRIP: DemoTripContent = {
  destinationId: "cancun",
  flag: "🇲🇽",
  budgetLabel: "$700 budget",
  total: 642,
  flight: 280,
  hotel: 210,
  activities: 152,
};

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

export interface HomeLayoutConfig {
  sectionOrder: HomeSectionId[];
  demoTrip: DemoTripContent;
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
  const fallback: HomeLayoutConfig = { sectionOrder: DEFAULT_SECTION_ORDER, demoTrip: DEFAULT_DEMO_TRIP };
  if (!credentials) return fallback;
  if (cachedLayout && cachedLayout.expiresAt > Date.now()) return cachedLayout.config;
  try {
    const doc = await getDocument("siteConfig", "home", credentials);
    if (!doc) return fallback;
    const config: HomeLayoutConfig = { sectionOrder: DEFAULT_SECTION_ORDER, demoTrip: { ...DEFAULT_DEMO_TRIP } };
    if (typeof doc.sectionOrder === "string") {
      // Firestore (vía toFirestoreFields) solo guarda planos — un array se
      // manda como JSON serializado a mano, no como lista nativa.
      try {
        config.sectionOrder = normalizeSectionOrder(JSON.parse(doc.sectionOrder));
      } catch {
        config.sectionOrder = DEFAULT_SECTION_ORDER;
      }
    }
    if (typeof doc.demoDestinationId === "string" && doc.demoDestinationId) config.demoTrip.destinationId = doc.demoDestinationId;
    if (typeof doc.demoFlag === "string") config.demoTrip.flag = doc.demoFlag;
    if (typeof doc.demoBudgetLabel === "string" && doc.demoBudgetLabel) config.demoTrip.budgetLabel = doc.demoBudgetLabel;
    if (typeof doc.demoTotal === "number") config.demoTrip.total = doc.demoTotal;
    if (typeof doc.demoFlight === "number") config.demoTrip.flight = doc.demoFlight;
    if (typeof doc.demoHotel === "number") config.demoTrip.hotel = doc.demoHotel;
    if (typeof doc.demoActivities === "number") config.demoTrip.activities = doc.demoActivities;
    cachedLayout = { config, expiresAt: Date.now() + CACHE_TTL_MS };
    return config;
  } catch {
    return fallback;
  }
}
