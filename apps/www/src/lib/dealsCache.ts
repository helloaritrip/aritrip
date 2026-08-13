import {
  destinations,
  listDocuments,
  generateAllPriceSnapshots,
  detectFlightDeals,
  DEFAULT_PARTNER_CONFIG,
  type FirestoreCredentials,
  type LiveFlightPrice,
  type FlightDeal,
  type PartnerConfig,
} from "@aritrips/data";

/**
 * Cache en memoria a nivel de módulo (2026-08-14) — bug real y grave
 * encontrado en producción: /deals leía la colección `livePrices` COMPLETA
 * (cientos de docs, cada uno cuenta como una lectura de Firestore) en
 * CADA visita, sin cachear nada. Eso agotó la cuota diaria gratis de
 * Firestore (429 "Quota exceeded"), y como la cuota es del proyecto
 * entero, tumbó TODO lo que lee Firestore — /blog, /p/[slug], el admin,
 * todo — no solo /deals. Mismo patrón de caché ya usado en
 * apps/app/src/lib/livePrices.ts (que si tenía TTL desde el principio,
 * por eso no le pasó esto). Los datos reales (apps/price-sync) solo
 * cambian cada ~15 min, así que un TTL de 10 min acá es imperceptible
 * para el usuario y baja el volumen de lecturas en varios órdenes de
 * magnitud (compartido entre TODOS los visitantes de un mismo isolate
 * caliente del Worker, no por-visitante).
 */
let cachedDeals: { deals: FlightDeal[]; expiresAt: number } | null = null;
let cachedPartnerConfig: { config: PartnerConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function getCachedFlightDeals(credentials: FirestoreCredentials): Promise<FlightDeal[]> {
  if (cachedDeals && cachedDeals.expiresAt > Date.now()) return cachedDeals.deals;

  const liveDocs = await listDocuments("livePrices", credentials);
  const livePrices: LiveFlightPrice[] = liveDocs
    .filter(
      (d) =>
        d.id !== "_cursor" &&
        typeof d.destinationId === "string" &&
        typeof d.originAirportCode === "string" &&
        typeof d.avgFlightCostUSD === "number"
    )
    .map((d) => ({
      destinationId: d.destinationId as string,
      originAirportCode: d.originAirportCode as string,
      avgFlightCostUSD: d.avgFlightCostUSD as number,
      avgFlightDurationMinutes: (d.avgFlightDurationMinutes as number) ?? 0,
      capturedAt: (d.capturedAt as string) ?? new Date().toISOString(),
      transfers: typeof d.transfers === "number" ? d.transfers : undefined,
      airline: typeof d.airline === "string" ? d.airline : undefined,
      searchPeriod: typeof d.searchPeriod === "string" ? d.searchPeriod : undefined,
    }));

  const curatedSnapshots = generateAllPriceSnapshots(destinations);
  const deals = detectFlightDeals(livePrices, destinations, curatedSnapshots);
  cachedDeals = { deals, expiresAt: Date.now() + CACHE_TTL_MS };
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
  cachedPartnerConfig = { config, expiresAt: Date.now() + CACHE_TTL_MS };
  return config;
}
