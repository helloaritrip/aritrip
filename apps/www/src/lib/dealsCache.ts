import {
  destinations,
  getDocument,
  listDocuments,
  fromStoredFlightDeal,
  DEFAULT_PARTNER_CONFIG,
  type FirestoreCredentials,
  type FlightDeal,
  type StoredFlightDeal,
  type PartnerConfig,
} from "@aritrips/data";

/**
 * Cache en memoria a nivel de módulo (2026-08-14) — bug real y grave
 * encontrado en producción: /deals leía la colección `livePrices`
 * COMPLETA (cientos de docs, cada uno cuenta como una lectura de
 * Firestore) en CADA visita para calcular las ofertas. Eso agotó la cuota
 * diaria gratis de Firestore (429 "Quota exceeded"), y como la cuota es
 * del proyecto entero, tumbó TODO lo que lee Firestore — /blog,
 * /p/[slug], el admin, todo — no solo /deals.
 *
 * Arreglado en dos capas (2026-08-14):
 *  1) apps/price-sync ahora mantiene un solo documento (dealsCache/current)
 *     con las ofertas ya calculadas, actualizado de forma incremental a
 *     medida que procesa cada lote de rutas — ver evaluateFlightDeal en
 *     packages/data/src/deals.ts. Un cache-miss acá ya no cuesta cientos
 *     de lecturas, cuesta UNA.
 *  2) Este caché en memoria (TTL corto) evita incluso esa única lectura
 *     en la mayoría de las visitas, compartido entre todos los
 *     visitantes de un mismo isolate caliente del Worker.
 */
let cachedDeals: { deals: FlightDeal[]; expiresAt: number } | null = null;
let cachedPartnerConfig: { config: PartnerConfig; expiresAt: number } | null = null;
// TTLs subidos (2026-08-15, auditoría de lecturas post-reset de cuota) —
// este caché en memoria ahora es secundario (la Cache API en middleware.ts
// es la capa principal), pero sigue siendo el que evita que /deals con
// distintas combinaciones de filtro/orden/página (cada una una URL/cache-key
// distinta a nivel de borde) relean Firestore por separado. 10 min para
// deals porque apps/price-sync solo refresca cada ruta cada ~16h — no hay
// frescura real que ganar yendo más seguido. 30 min para partners porque
// son valores que solo cambia un humano a mano, nunca un cron.
const DEALS_CACHE_TTL_MS = 20 * 60 * 1000;
const PARTNER_CACHE_TTL_MS = 60 * 60 * 1000;

export async function getCachedFlightDeals(credentials: FirestoreCredentials): Promise<FlightDeal[]> {
  if (cachedDeals && cachedDeals.expiresAt > Date.now()) return cachedDeals.deals;

  const doc = await getDocument("dealsCache", "current", credentials);
  let deals: FlightDeal[] = [];
  if (doc && typeof doc.dealsJson === "string") {
    try {
      const stored = JSON.parse(doc.dealsJson) as StoredFlightDeal[];
      deals = stored
        .map((d) => fromStoredFlightDeal(d, destinations))
        .filter((d): d is FlightDeal => d !== null)
        .sort((a, b) => b.discountPercent - a.discountPercent);
    } catch {
      deals = [];
    }
  }

  cachedDeals = { deals, expiresAt: Date.now() + DEALS_CACHE_TTL_MS };
  return deals;
}

export async function getCachedPartnerConfig(credentials: FirestoreCredentials): Promise<PartnerConfig> {
  if (cachedPartnerConfig && cachedPartnerConfig.expiresAt > Date.now()) return cachedPartnerConfig.config;

  const partnerDocs = await listDocuments("partners", credentials);
  const config: PartnerConfig = { ...DEFAULT_PARTNER_CONFIG };
  for (const doc of partnerDocs) {
    const category = doc.category as keyof PartnerConfig;
    if (category in config && typeof doc.value === "string" && doc.active !== false) {
      config[category] = { ...config[category], value: doc.value };
    }
  }
  cachedPartnerConfig = { config, expiresAt: Date.now() + PARTNER_CACHE_TTL_MS };
  return config;
}
