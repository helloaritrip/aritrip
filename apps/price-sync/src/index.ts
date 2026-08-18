/**
 * Worker chico y separado (2026-08-07) cuyo único trabajo es mantener
 * dos colecciones de Firestore con precios reales:
 *  - `livePrices` (vuelos) — Travelpayouts Data API (misma cuenta que ya
 *    usamos para Kiwi.com, necesita TRAVELPAYOUTS_TOKEN).
 *  - `liveHotelPrices` (hoteles) — Xotelo (xotelo.com, gratis, sin
 *    token/cuenta) contra un hotel de gama media curado a mano por
 *    destino (ver packages/data/src/hotelKeys.ts). Se intentó primero
 *    con la Hotellook Data API de Travelpayouts — Hotellook cerró como
 *    marca en octubre 2025, su API ya no existe. El endpoint /list de
 *    Xotelo (promedio de toda una ciudad) también está roto en la
 *    práctica; /rates (un hotel puntual) sí funciona, por eso el diseño
 *    de "un hotel ancla por destino" en vez de un promedio real.
 *
 * apps/app lee esas colecciones (ver apps/app/src/lib/livePrices.ts) y
 * recalibra los estimados curados de packages/data con esto — ver
 * packages/data/src/livePrices.ts para el porqué de recalibrar en vez
 * de reemplazar.
 *
 * Nadie dispara esto a mano en el día a día: Cloudflare lo despierta
 * solo en dos horarios distintos (ver wrangler.jsonc). Cero costo/
 * dependencia de Claude en runtime — es un cron job común y corriente.
 *
 * Por qué en lotes y no todo de una: Cloudflare Workers (plan free)
 * limita a 50 subrequests salientes por invocación, y cada ruta/hotel
 * gasta hasta 2 (API externa + Firestore). Cada corrida procesa un
 * lote y guarda en Firestore en qué lote se quedó (`_cursor`) para
 * retomar ahí la próxima vez — vuelos (952 rutas) da la vuelta completa
 * cada ~16h, hoteles (40 destinos) cada ~1h.
 */
import {
  destinations,
  originBaseCosts,
  getDocument,
  setDocument,
  listDocuments,
  queryDocuments,
  countDocuments,
  writeFirestoreDocument,
  livePriceDocId,
  HOTEL_KEYS,
  timingSafeEqual,
  generateAllPriceSnapshots,
  evaluateFlightDeal,
  toStoredFlightDeal,
  type FirestoreCredentials,
  type StoredFlightDeal,
} from "@aritrips/data";

export interface Env {
  TRAVELPAYOUTS_TOKEN: string;
  // SerpApi (Google Flights) — 2026-08-17, fuente de respaldo para las
  // rutas que Travelpayouts nunca cachea (no depende de que otro viajero
  // real haya buscado esa ruta antes, a diferencia de la Data API de
  // Travelpayouts). Tier gratis: 250 búsquedas/mes — ver SERPAPI_BATCH_SIZE.
  SERPAPI_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  PRICE_SYNC_TRIGGER_KEY: string;
}

// Ver wrangler.jsonc — deben quedar idénticos a "triggers.crons" para que
// el dispatcher de abajo sepa cuál corrida le toca a cada uno.
const HOTEL_CRON = "5-59/20 * * * *";
const SERPAPI_CRON = "30 6 * * *";
// Corre cada 15 min igual que el cron principal de vuelos, corrido 8 min
// (nunca coincide con :00/:15/:30/:45 ni con el de hoteles en :05/:25/:45)
// para que las dos corridas de Travelpayouts no le peguen encima al mismo
// segundo — cada invocación termina bien dentro del minuto (20 rutas ×
// ~1.1s ≈ 22s), así que alcanza con no arrancar al mismo tiempo.
const PRIORITY_CRON = "8-59/15 * * * *";

// Encontrado en producción (2026-08-07): con 40 tiraba "Too many
// subrequests by single Worker invocation" — el plan free de Workers
// limita a 50 subrequests/invocación, esto deja margen de sobra.
const BATCH_SIZE = 15;
// Bajado de 15 a 10 (2026-08-13): antes cada destino gastaba a lo sumo 2
// subrequests (Xotelo + Firestore), ahora hasta 4 (hasta 3 tiers de hotel
// + 1 escritura) porque algunos destinos ya tienen budget/mid/premium —
// 15×4=60 se pasaría del límite de 50 que ya rompió esto una vez.
const HOTEL_BATCH_SIZE = 10;
// ~1 request/segundo — margen de sobra frente al límite de 60/min de
// Travelpayouts; Xotelo no publica un límite pero se mantiene el mismo
// ritmo por prolijidad, no hay apuro.
const DELAY_BETWEEN_REQUESTS_MS = 1100;
// 250 búsquedas gratis/mes ÷ ~31 días ≈ 8/día — 8×31=248 deja margen sin
// pagar nada. Corre una sola vez al día (ver SERPAPI_CRON), no cada 15
// min como vuelos/hoteles, así que el límite de 50 subrequests/invocación
// de Cloudflare ni entra en juego acá (8×2 = 16).
const SERPAPI_BATCH_SIZE = 8;

function credentialsFrom(env: Env): FirestoreCredentials {
  return { clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function periodForMonthsAhead(monthsAhead: number): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

// Rotación de ventana de anticipación (2026-08-18, a partir de una sugerencia
// del "head" del usuario: agrupar precios por anticipación — 7/14/30/60/90
// días — y sacar percentiles en vez de un solo ancla). Travelpayouts es un
// CACHÉ PASIVO (solo devuelve algo si un viajero real ya buscó esa fecha
// exacta) — pedirle un día puntual a 7-14 días vista para una ruta de nicho
// devuelve vacío la mayoría de las veces (ya confirmado en vivo, ver
// fetchCheapestFare). Con granularidad de MES sí se puede rotar de forma
// confiable entre ~30/~60/~90 días de anticipación sin perder cobertura —
// no es tan fino como pediría el head, pero es lo que da esta fuente gratis
// sin arriesgar los datos que ya tenemos. Cada corrida de cron completa usa
// UNA sola ventana (no una por ruta) para que decenas de rutas no queden
// mezclando ventanas en el mismo lote; la rotación día a día (no por lote)
// es lo que con el tiempo arma las 3 canastas por ruta.
const ADVANCE_MONTHS_BUCKETS = [1, 2, 3] as const;

function advanceMonthsForCycle(): number {
  const epochDay = Math.floor(Date.now() / 86_400_000);
  return ADVANCE_MONTHS_BUCKETS[epochDay % ADVANCE_MONTHS_BUCKETS.length];
}

// Registro histórico (2026-08-18, a pedido del usuario: "quiero que
// llevemos ese registro" de cómo van cambiando los precios día a día).
// A diferencia de `livePrices`/`liveHotelPrices` (que SIEMPRE pisan el
// mismo documento por ruta/destino — solo queda la última captura), acá
// cada captura exitosa suma un documento nuevo con ID automático
// (writeFirestoreDocument, no setDocument) — nunca se pisa nada. Por
// ahora solo se acumula, no se lee/calcula nada con esto todavía (eso
// queda para cuando haya volumen real, ver la nota de "Fase futura" en
// priceEstimation.ts). Best-effort: si esta escritura falla, no cuenta
// como fallo de la captura principal (ya se guardó en la colección
// "viva"), solo se loguea.
async function recordFlightPriceHistory(
  entry: {
    destinationId: string;
    originAirportCode: string;
    avgFlightCostUSD: number;
    avgFlightDurationMinutes: number;
    transfers?: number;
    airline?: string;
    searchPeriod: string;
    capturedAt: string;
    // Ver advanceMonthsForCycle — cuántos meses de anticipación tenía la
    // fecha consultada, para poder agrupar priceHistory por ventana
    // (30/60/90 días aprox.) más adelante. SerpApi usa una constante fija
    // (ver serpApiDateWindow, ~70 días ≈ 2 meses) en vez de rotar.
    advanceMonthsBucket: number;
  },
  source: "provider_api" | "serpapi",
  credentials: FirestoreCredentials
): Promise<void> {
  try {
    await writeFirestoreDocument("priceHistory", { type: "flight", source, ...entry }, credentials);
  } catch (err) {
    console.warn(`[price-sync] history write failed (flight ${entry.destinationId} from ${entry.originAirportCode})`, err);
  }
}

async function recordHotelPriceHistory(
  entry: { destinationId: string; avgHotelBudgetUSD?: number; avgHotelMidUSD: number; avgHotelPremiumUSD?: number; capturedAt: string },
  credentials: FirestoreCredentials
): Promise<void> {
  try {
    await writeFirestoreDocument("priceHistory", { type: "hotel", ...entry }, credentials);
  } catch (err) {
    console.warn(`[price-sync] history write failed (hotel ${entry.destinationId})`, err);
  }
}

// ---------- Vuelos (Travelpayouts Data API) ----------

interface RoutePair {
  destinationId: string;
  originAirportCode: string;
  destinationAirportCode: string;
}

// Destinos sin vuelo internacional directo a su propio aeropuerto — se
// llega siempre con un tramo doméstico de conexión. Pedirle a
// Travelpayouts origen→destino directo nunca va a devolver nada — no es
// que falten datos, es que esa ruta de un solo tramo no existe. El
// estimado curado en originBaseCosts.ts para estos ya asume el conector
// doméstico (precio y duración sensiblemente más altos que un salto
// corto real), así que no hace falta verificarlo en vivo contra un
// vuelo directo — mejor no gastar ciclos del cron en una ruta que jamás
// va a tener resultado.
//  - galapagos (GPS/SCY): sin vuelo comercial internacional directo a
//    agosto 2026 desde ningún origen — se llega vía Quito/Guayaquil.
//    Investigado y confirmado por el usuario (2026-08-10).
//
// cusco (CUZ) SACADO de esta lista (2026-08-17, a pedido del usuario:
// "incorporemos a cusco a pesar de la escala") — mismo motivo original
// (se llega vía Lima, sin vuelo directo) pero ya no es razón para
// excluirlo: SerpApi (Google Flights, ver más abajo) SÍ resuelve
// itinerarios con conexión de verdad, a diferencia de Travelpayouts
// (que solo devuelve algo si un viajero real ya buscó exactamente ese
// par origen-destino, y nadie busca "JFK a Cusco" directo). Se acepta
// mostrar precio con escala en vez de no mostrar nada.
const NO_DIRECT_INTERNATIONAL_SERVICE = new Set(["galapagos"]);

function buildAllRoutePairs(): RoutePair[] {
  const pairs: RoutePair[] = [];
  const destById = new Map(destinations.map((d) => [d.id, d]));

  for (const destinationId of Object.keys(originBaseCosts).sort()) {
    if (NO_DIRECT_INTERNATIONAL_SERVICE.has(destinationId)) continue;
    const destination = destById.get(destinationId);
    if (!destination) continue; // catálogo pudo cambiar desde que se curó originBaseCosts

    const bases = [...originBaseCosts[destinationId]].sort((a, b) => a.originAirportCode.localeCompare(b.originAirportCode));
    for (const base of bases) {
      pairs.push({
        destinationId,
        originAirportCode: base.originAirportCode,
        destinationAirportCode: destination.airportCodes[0],
      });
    }
  }
  return pairs;
}

interface TravelpayoutsFare {
  price: number;
  durationOneWay: number;
  transfers: number;
  airline: string;
}

async function fetchCheapestFare(pair: RoutePair, token: string, period: string): Promise<TravelpayoutsFare | null> {
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.searchParams.set("origin", pair.originAirportCode);
  url.searchParams.set("destination", pair.destinationAirportCode);
  url.searchParams.set("departure_at", period);
  // Sin return_at (2026-08-10, hallazgo en vivo con logs reales) — forzar
  // la vuelta al MISMO mes exacto que la ida hacía que casi cualquier ruta
  // sin muchísimo volumen de búsquedas reales cacheadas devolviera
  // data:[] (confirmado viendo la respuesta cruda en producción: 15/15
  // rutas de un lote volvieron vacías, success:true). Un viaje real de
  // 1-2 semanas suele cruzar de fin de mes a principio del siguiente;
  // one_way=false ya le indica a la API que junte ida+vuelta sin
  // necesidad de forzarle un mes de regreso.
  url.searchParams.set("one_way", "false");
  url.searchParams.set("currency", "usd");
  url.searchParams.set("market", "us");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("limit", "1");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), { headers: { "Accept-Encoding": "gzip" } });
  if (!res.ok) {
    console.warn(`[price-sync] flight ${pair.destinationId} from ${pair.originAirportCode}: HTTP ${res.status}`);
    return null;
  }

  const bodyText = await res.text();
  let body: {
    success: boolean;
    data?: Array<{ price: number; duration: number; duration_to?: number; transfers: number; airline: string }>;
  };
  try {
    body = JSON.parse(bodyText);
  } catch {
    console.warn(`[price-sync] flight ${pair.destinationId} from ${pair.originAirportCode}: invalid JSON — ${bodyText.slice(0, 200)}`);
    return null;
  }
  if (!body.success || !body.data || body.data.length === 0) {
    // Diagnóstico temporal (2026-08-10) — para saber si el hueco de
    // rutas sin tarifa es de parámetros de la consulta o de datos reales
    // que Travelpayouts no tiene cacheados para esta ruta/período.
    console.warn(`[price-sync] flight ${pair.destinationId} from ${pair.originAirportCode}: no fare — ${bodyText.slice(0, 200)}`);
    return null;
  }

  const fare = body.data[0];
  if (typeof fare.price !== "number" || fare.price <= 0) return null;

  // `duration` es el total ida+vuelta (confirmado probando la API en vivo:
  // duration_to + duration_back == duration) — el resto del sistema
  // (originBaseCosts.ts, travelTimeScore) espera la duración de UN solo
  // tramo, así que hay que usar duration_to, no duration. Guardar el
  // total acá metía un bug real: rutas con datos en vivo puntuaban mal
  // en "Flight convenience" porque parecían el doble de largas de lo que
  // son. Si no viene duration_to (no debería pasar, pero por las dudas),
  // se aproxima a la mitad del total en vez de romper.
  const durationOneWay = typeof fare.duration_to === "number" && fare.duration_to > 0 ? fare.duration_to : Math.round((fare.duration ?? 0) / 2);

  return { price: fare.price, durationOneWay, transfers: fare.transfers ?? 0, airline: fare.airline ?? "" };
}

interface LatestFoundFare {
  price: number;
  transfers: number;
  departDate: string; // "YYYY-MM-DD" — la fecha real que un viajero buscó, no un período que nosotros elegimos
}

// v2/prices/latest (2026-08-18, investigado a pedido del usuario buscando
// "otra fuente gratis") — MISMA cuenta/token que prices_for_dates, pero
// lee directo el registro de tarifas encontradas en vez de la agregación
// "más barata del mes/período que yo pida". Sin duration/airline en la
// respuesta (esta API no los da) — se usa como ÚLTIMO recurso después de
// agotar los 6 meses de fetchCheapestFare, así que el resto del pipeline
// completa duration con el estimado curado en vez de con un dato real.
async function fetchLatestFoundFare(pair: RoutePair, token: string): Promise<LatestFoundFare | null> {
  const url = new URL("https://api.travelpayouts.com/v2/prices/latest");
  url.searchParams.set("origin", pair.originAirportCode);
  url.searchParams.set("destination", pair.destinationAirportCode);
  url.searchParams.set("period_type", "year");
  url.searchParams.set("one_way", "false");
  url.searchParams.set("currency", "USD");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("limit", "1");
  url.searchParams.set("show_to_affiliates", "true");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), { headers: { "Accept-Encoding": "gzip" } });
  if (!res.ok) return null;

  let body: { success: boolean; data?: Array<{ value: number; number_of_changes: number; depart_date: string }> };
  try {
    body = await res.json();
  } catch {
    return null;
  }
  if (!body.success || !body.data || body.data.length === 0) return null;

  const fare = body.data[0];
  if (typeof fare.value !== "number" || fare.value <= 0) return null;

  return { price: fare.value, transfers: fare.number_of_changes ?? 0, departDate: fare.depart_date };
}

// Doc único con TODAS las ofertas vigentes, mantenido de forma
// incremental acá mismo (2026-08-14) — antes /deals en apps/www tenía que
// leer la colección `livePrices` COMPLETA (cientos de docs) para
// calcularlas en cada visita, lo que agotó la cuota gratis de Firestore
// una vez (ver apps/www/src/lib/dealsCache.ts). Evaluar si una ruta es
// oferta solo necesita SU propio precio + la curva curada de ese destino
// — no hace falta releer el resto de la colección, así que esto se arma
// ruta por ruta a medida que el batch ya las procesa, sin ninguna lectura
// nueva de colección completa. Costo extra: 1 lectura + a lo sumo 1
// escritura por corrida del cron (cada 15 min), no por visitante.
const DEALS_CACHE_DOC = "current";

async function updateDealsIndex(
  credentials: FirestoreCredentials,
  updates: { destinationId: string; originAirportCode: string; deal: ReturnType<typeof evaluateFlightDeal> }[]
): Promise<void> {
  if (updates.length === 0) return;

  const existing = await getDocument("dealsCache", DEALS_CACHE_DOC, credentials);
  const stored: StoredFlightDeal[] = (() => {
    if (typeof existing?.dealsJson !== "string") return [];
    try {
      return JSON.parse(existing.dealsJson) as StoredFlightDeal[];
    } catch {
      return [];
    }
  })();

  const byKey = new Map(stored.map((d) => [livePriceDocId(d.destinationId, d.originAirportCode), d]));
  for (const u of updates) {
    const key = livePriceDocId(u.destinationId, u.originAirportCode);
    if (u.deal) byKey.set(key, toStoredFlightDeal(u.deal));
    else byKey.delete(key);
  }

  await setDocument(
    "dealsCache",
    DEALS_CACHE_DOC,
    { dealsJson: JSON.stringify([...byKey.values()]), updatedAt: new Date() },
    credentials
  );
}

async function runFlightBatch(env: Env): Promise<{ processed: number; written: number; skipped: number; nextOffset: number; total: number }> {
  const credentials = credentialsFrom(env);

  const allPairs = buildAllRoutePairs();
  const cursorDoc = await getDocument("livePrices", "_cursor", credentials);
  const offset = typeof cursorDoc?.offset === "number" ? cursorDoc.offset : 0;

  const batch: RoutePair[] = [];
  for (let i = 0; i < BATCH_SIZE && i < allPairs.length; i++) {
    batch.push(allPairs[(offset + i) % allPairs.length]);
  }

  let written = 0;
  let skipped = 0;
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const curatedSnapshots = generateAllPriceSnapshots(destinations);
  const dealUpdates: { destinationId: string; originAirportCode: string; deal: ReturnType<typeof evaluateFlightDeal> }[] = [];

  // Ancla FIJA en ~30 días (2026-08-18, corregido tras darme cuenta del
  // problema en el camino) — esta corrida escribe `livePrices`, el precio
  // que el usuario ve en el sitio. Si acá rotara la ventana día a día
  // (como se intentó primero), el mismo destino mostraría un precio
  // distinto solo por casualidad de qué ventana tocaba ese día, sin que el
  // mercado se haya movido — ruido que el usuario no debería ver. La
  // rotación de ventanas (30/60/90) vive SOLO en runPriorityBatch, que
  // alimenta `priceHistory` (investigación) y no toca `livePrices` salvo
  // cuando cae justo en la ventana de 30 días.
  const monthsAhead = 1;
  const period = periodForMonthsAhead(monthsAhead);

  for (const pair of batch) {
    try {
      const fare = await fetchCheapestFare(pair, env.TRAVELPAYOUTS_TOKEN, period);
      if (!fare) {
        skipped += 1;
      } else {
        // searchPeriod (2026-08-10, extensión del dato observado a pedido
        // del usuario) — de qué mes es esta tarifa, para poder analizar
        // más adelante si nuestro ancla "medio plazo" (ver
        // priceEstimation.ts) sigue siendo razonable.
        const capturedAt = new Date().toISOString();
        const liveEntry = {
          destinationId: pair.destinationId,
          originAirportCode: pair.originAirportCode,
          avgFlightCostUSD: Math.round(fare.price),
          avgFlightDurationMinutes: Math.round(fare.durationOneWay),
          transfers: fare.transfers,
          airline: fare.airline,
          searchPeriod: period,
          capturedAt,
          advanceMonthsBucket: monthsAhead,
        };
        await setDocument("livePrices", livePriceDocId(pair.destinationId, pair.originAirportCode), liveEntry, credentials);
        written += 1;
        await recordFlightPriceHistory(liveEntry, "provider_api", credentials);

        const deal = evaluateFlightDeal(
          liveEntry,
          destById.get(pair.destinationId),
          curatedSnapshots
        );
        dealUpdates.push({ destinationId: pair.destinationId, originAirportCode: pair.originAirportCode, deal });
      }
    } catch (err) {
      console.error(`[price-sync] flight ${pair.destinationId} from ${pair.originAirportCode}: failed`, err);
      skipped += 1;
    }
    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }

  await updateDealsIndex(credentials, dealUpdates);

  const nextOffset = (offset + BATCH_SIZE) % allPairs.length;
  await setDocument("livePrices", "_cursor", { offset: nextOffset, updatedAt: new Date().toISOString() }, credentials);

  return { processed: batch.length, written, skipped, nextOffset, total: allPairs.length };
}

// ---------- Vuelos, fuente de respaldo (SerpApi / Google Flights) ----------
//
// A diferencia de Travelpayouts (arriba), esto no recorre TODAS las
// rutas por turno con un cursor — busca activamente cuáles son las que
// menos cobertura tienen (a pedido del usuario: "usemos estratégicamente
// para buscar los destinos que tenemos menos info") y prioriza esas.
// Recalcula la prioridad desde cero en cada corrida (lee el estado real
// de `livePrices`), así que se auto-corrige solo a medida que
// Travelpayouts también va llenando huecos con el tiempo — no hace
// falta coordinarlo con el cursor del otro cron.

// Ventana de fecha fija (2026-08-17): a diferencia de Travelpayouts (que
// solo entiende "mes"), SerpApi pide fechas exactas — se elige ~70 días
// adelante (dentro del bucket neutral de anticipación, ver
// ADVANCE_PURCHASE_FACTORS en priceEstimation.ts) y un viaje de 7 noches,
// mismo criterio de "precio típico" que ya usa el resto del sistema.
function serpApiDateWindow(): { outboundDate: string; returnDate: string } {
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const outbound = new Date(Date.now() + 70 * 24 * 60 * 60 * 1000);
  const ret = new Date(outbound.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { outboundDate: fmt(outbound), returnDate: fmt(ret) };
}

async function fetchSerpApiFare(pair: RoutePair, apiKey: string): Promise<TravelpayoutsFare | null> {
  const { outboundDate, returnDate } = serpApiDateWindow();
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_flights");
  url.searchParams.set("departure_id", pair.originAirportCode);
  url.searchParams.set("arrival_id", pair.destinationAirportCode);
  url.searchParams.set("outbound_date", outboundDate);
  url.searchParams.set("return_date", returnDate);
  url.searchParams.set("type", "1"); // round trip
  // Mayúsculas a propósito — SerpApi rechaza "usd" en minúscula con
  // "Unsupported `usd` for currency" (encontrado probando en vivo,
  // 2026-08-17), a diferencia de Travelpayouts que sí acepta minúscula.
  url.searchParams.set("currency", "USD");
  url.searchParams.set("adults", "1");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn(`[price-sync] serpapi ${pair.destinationId} from ${pair.originAirportCode}: HTTP ${res.status}`);
    return null;
  }

  const body = (await res.json()) as {
    best_flights?: Array<{ price?: number; total_duration?: number; flights?: Array<{ airline?: string }> }>;
    other_flights?: Array<{ price?: number; total_duration?: number; flights?: Array<{ airline?: string }> }>;
  };
  const options = [...(body.best_flights ?? []), ...(body.other_flights ?? [])].filter(
    (o): o is { price: number; total_duration?: number; flights?: Array<{ airline?: string }> } => typeof o.price === "number" && o.price > 0
  );
  if (options.length === 0) {
    console.warn(`[price-sync] serpapi ${pair.destinationId} from ${pair.originAirportCode}: no fare found`);
    return null;
  }

  // Guardrail de sensatez (2026-08-18, bug real encontrado en auditoría):
  // "la más barata" a veces resulta ser una escala pésima de verdad — visto
  // en vivo con datos reales, Cusco desde ATL quedó con total_duration=2975
  // (49.6h) y Turks and Caicos con varias de 18-24h, todas vía Air Canada
  // por Toronto (aeropuertos chicos, poca frecuencia). El campo se lee
  // bien (confirmado contra la respuesta cruda: incluye la espera real de
  // la escala) — el problema es no filtrar por duración antes de elegir
  // "la más barata", igual que ya se protege el precio con
  // MAX_TOTAL_MULTIPLIER en priceEstimation.ts. Se prefiere la más barata
  // CON duración razonable; si ninguna la tiene, se cae a la más barata
  // igual (mejor un dato real raro que ningún dato).
  const MAX_REASONABLE_DURATION_MINUTES = 20 * 60; // 20h
  const reasonable = options.filter((o) => (o.total_duration ?? 0) <= MAX_REASONABLE_DURATION_MINUTES);
  const pool = reasonable.length > 0 ? reasonable : options;
  if (reasonable.length === 0) {
    console.warn(
      `[price-sync] serpapi ${pair.destinationId} from ${pair.originAirportCode}: every option has an unreasonable duration, using cheapest anyway`
    );
  }

  const cheapest = pool.reduce((min, o) => (o.price < min.price ? o : min));
  return {
    price: cheapest.price,
    durationOneWay: cheapest.total_duration ?? 0,
    transfers: Math.max(0, (cheapest.flights?.length ?? 1) - 1),
    airline: cheapest.flights?.[0]?.airline ?? "",
  };
}

/**
 * Rutas sin precio en vivo, repartidas entre destinos distintos — no solo
 * "las de menor cobertura", sino una por destino, dando la vuelta en
 * rondas (2026-08-17, a pedido del usuario: "priorizando destinos que
 * nunca han tenido nada"). Ordenar solo por cobertura y cortar en
 * `limit` tenía un problema real: un destino con muchos huecos podía
 * consumir el lote entero él solo, dejando a otros destinos en cero sin
 * tocar ni una ruta. Con esto, un lote de 8 toca hasta 8 destinos
 * distintos (empezando por los de menor cobertura) antes de repetir
 * ninguno.
 */
async function getLeastCoveredGapRoutes(
  credentials: FirestoreCredentials,
  limit: number,
  // Evita releer `livePrices` entera cuando el caller ya la tiene (2026-08-18,
  // encontrado en vivo — ?mode=gaps la leía DOS veces: una para su propia
  // respuesta, otra acá adentro, y con la colección ya grande eso empezó a
  // dar error 1101 en el cliente por lo lenta que se puso la corrida).
  liveEntriesOverride?: (Record<string, unknown> & { id: string })[]
): Promise<RoutePair[]> {
  const allPairs = buildAllRoutePairs();
  const liveEntries = liveEntriesOverride ?? (await listDocuments("livePrices", credentials)).filter((d) => d.id !== "_cursor");
  const liveKeys = new Set(liveEntries.map((d) => d.id));

  const liveCountByDest = new Map<string, number>();
  for (const doc of liveEntries) {
    const id = doc.destinationId as string;
    liveCountByDest.set(id, (liveCountByDest.get(id) ?? 0) + 1);
  }

  const gapsByDest = new Map<string, RoutePair[]>();
  for (const p of allPairs) {
    if (liveKeys.has(livePriceDocId(p.destinationId, p.originAirportCode))) continue;
    if (!gapsByDest.has(p.destinationId)) gapsByDest.set(p.destinationId, []);
    gapsByDest.get(p.destinationId)!.push(p);
  }

  const destOrder = [...gapsByDest.keys()].sort((a, b) => (liveCountByDest.get(a) ?? 0) - (liveCountByDest.get(b) ?? 0));

  const selected: RoutePair[] = [];
  for (let round = 0; selected.length < limit; round++) {
    let addedThisRound = false;
    for (const destId of destOrder) {
      const remaining = gapsByDest.get(destId)!;
      if (round >= remaining.length) continue;
      selected.push(remaining[round]);
      addedThisRound = true;
      if (selected.length >= limit) break;
    }
    if (!addedThisRound) break; // no quedan huecos en ningún destino
  }

  return selected;
}

/** Núcleo compartido: consulta SerpApi para una lista de rutas YA elegida y las guarda. */
async function runSerpApiOnPairs(pairs: RoutePair[], env: Env): Promise<{ processed: number; written: number; skipped: number }> {
  const credentials = credentialsFrom(env);
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const curatedSnapshots = generateAllPriceSnapshots(destinations);
  const dealUpdates: { destinationId: string; originAirportCode: string; deal: ReturnType<typeof evaluateFlightDeal> }[] = [];

  let written = 0;
  let skipped = 0;

  for (const pair of pairs) {
    try {
      const fare = await fetchSerpApiFare(pair, env.SERPAPI_KEY);
      if (!fare) {
        skipped += 1;
      } else {
        const capturedAt = new Date().toISOString();
        const searchPeriod = serpApiDateWindow().outboundDate.slice(0, 7); // "YYYY-MM" — mismo formato que usa Travelpayouts
        const liveEntry = {
          destinationId: pair.destinationId,
          originAirportCode: pair.originAirportCode,
          avgFlightCostUSD: Math.round(fare.price),
          avgFlightDurationMinutes: Math.round(fare.durationOneWay),
          transfers: fare.transfers,
          airline: fare.airline,
          searchPeriod,
          source: "serpapi", // distingue de Travelpayouts en el panel de admin, no cambia cómo se usa el dato
          capturedAt,
          // serpApiDateWindow() es fija (~70 días), no rota como
          // advanceMonthsForCycle — 70/30≈2, mismo bucket que la ventana
          // "media" de Travelpayouts, para que ambas fuentes queden
          // comparables al agrupar priceHistory por anticipación.
          advanceMonthsBucket: 2,
        };
        await setDocument("livePrices", livePriceDocId(pair.destinationId, pair.originAirportCode), liveEntry, credentials);
        written += 1;
        await recordFlightPriceHistory(liveEntry, "serpapi", credentials);

        const deal = evaluateFlightDeal(liveEntry, destById.get(pair.destinationId), curatedSnapshots);
        dealUpdates.push({ destinationId: pair.destinationId, originAirportCode: pair.originAirportCode, deal });
      }
    } catch (err) {
      console.error(`[price-sync] serpapi ${pair.destinationId} from ${pair.originAirportCode}: failed`, err);
      skipped += 1;
    }
    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }

  await updateDealsIndex(credentials, dealUpdates);

  return { processed: pairs.length, written, skipped };
}

async function runSerpApiBatch(env: Env): Promise<{ processed: number; written: number; skipped: number }> {
  const gapPairs = await getLeastCoveredGapRoutes(credentialsFrom(env), SERPAPI_BATCH_SIZE);
  return runSerpApiOnPairs(gapPairs, env);
}

// Disparo manual (2026-08-18, auditoría del día: recapturar rutas puntuales
// que quedaron con datos malos — ver el guardrail de duración en
// fetchSerpApiFare) — a diferencia de runSerpApiBatch, esto NO usa
// prioridad por cobertura, refresca TODAS las rutas de un destino
// puntual sin importar cuántas ya tenga. Uso: ?mode=serpapi-refresh&destinationId=X.
async function runSerpApiRefreshForDestination(destinationId: string, env: Env): Promise<{ processed: number; written: number; skipped: number }> {
  const pairs = buildAllRoutePairs().filter((p) => p.destinationId === destinationId);
  return runSerpApiOnPairs(pairs, env);
}

// Disparo manual (2026-08-17, a pedido del usuario: "forcemos más
// destinos sin precio con travelpayouts") — mismo criterio de reparto
// que runSerpApiBatch (getLeastCoveredGapRoutes), pero consultando
// Travelpayouts en vez de SerpApi. No toca el cursor de runFlightBatch
// (el cron normal de cada 15 min sigue su recorrido secuencial de
// siempre, sin enterarse de esto) — esto es puramente para adelantar a
// mano los huecos actuales sin esperar a que el cursor les toque el
// turno, que con ~1088 rutas puede tardar hasta 18h en llegar. Al no
// depender de una cuota mensual como SerpApi, el lote puede ser más
// grande (20×2=40 subrequests, dentro del límite de 50).
//
// Prueba varios meses por ruta (2026-08-18, a pedido del usuario tras
// confirmar que "el próximo mes" solo no encontraba nada en 3 lotes
// seguidos) — a diferencia de runFlightBatch/GapBatch para rutas YA
// cubiertas, acá no hay ningún precio previo que desestabilizar: probar
// hasta 6 meses de anticipación antes de rendirse con una ruta no le
// cambia nada al usuario (sigue viendo el estimado curado hasta que algo
// funcione), así que no hay motivo para quedarse solo con "el próximo
// mes" como hacían las otras corridas. Lote más chico (6, no 20) porque
// cada ruta ahora puede gastar hasta 6 llamadas a Travelpayouts + 1
// escritura = 7 subrequests; 6×7=42, dentro del límite de 50.
const GAP_MONTH_ATTEMPTS = [1, 2, 3, 4, 5, 6];
const TRAVELPAYOUTS_GAP_BATCH_SIZE = 6;

async function runTravelpayoutsGapBatch(env: Env): Promise<{ processed: number; written: number; skipped: number }> {
  const credentials = credentialsFrom(env);
  const gapPairs = await getLeastCoveredGapRoutes(credentials, TRAVELPAYOUTS_GAP_BATCH_SIZE);
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const curatedSnapshots = generateAllPriceSnapshots(destinations);
  const dealUpdates: { destinationId: string; originAirportCode: string; deal: ReturnType<typeof evaluateFlightDeal> }[] = [];

  let written = 0;
  let skipped = 0;

  for (const pair of gapPairs) {
    try {
      let fare: Awaited<ReturnType<typeof fetchCheapestFare>> = null;
      let monthsAhead = GAP_MONTH_ATTEMPTS[0];
      let period = periodForMonthsAhead(monthsAhead);
      for (const attempt of GAP_MONTH_ATTEMPTS) {
        monthsAhead = attempt;
        period = periodForMonthsAhead(attempt);
        fare = await fetchCheapestFare(pair, env.TRAVELPAYOUTS_TOKEN, period);
        if (fare) break;
        await delay(DELAY_BETWEEN_REQUESTS_MS);
      }

      // Último recurso (2026-08-18) — v2/prices/latest lee el registro
      // crudo de tarifas encontradas en vez de "la más barata del período
      // que yo pida", así que a veces encuentra algo que los 6 intentos de
      // arriba no. No trae duración/aerolínea, así que se completa con el
      // estimado curado de esta ruta en vez de inventar un número.
      let usedLatestFoundFallback = false;
      if (!fare) {
        await delay(DELAY_BETWEEN_REQUESTS_MS);
        const latest = await fetchLatestFoundFare(pair, env.TRAVELPAYOUTS_TOKEN);
        if (latest) {
          const curatedDuration = originBaseCosts[pair.destinationId]?.find((b) => b.originAirportCode === pair.originAirportCode)
            ?.avgFlightDurationMinutes;
          const daysAhead = Math.round((new Date(latest.departDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          monthsAhead = Math.max(1, Math.round(daysAhead / 30));
          period = periodForMonthsAhead(monthsAhead);
          fare = { price: latest.price, durationOneWay: curatedDuration ?? 180, transfers: latest.transfers, airline: "" };
          usedLatestFoundFallback = true;
        }
      }

      if (!fare) {
        skipped += 1;
      } else {
        const capturedAt = new Date().toISOString();
        const liveEntry = {
          destinationId: pair.destinationId,
          originAirportCode: pair.originAirportCode,
          avgFlightCostUSD: Math.round(fare.price),
          avgFlightDurationMinutes: Math.round(fare.durationOneWay),
          transfers: fare.transfers,
          airline: fare.airline,
          searchPeriod: period,
          capturedAt,
          advanceMonthsBucket: monthsAhead,
          // No es parte del union type de `source` (sigue siendo
          // Travelpayouts) — solo para poder filtrar más adelante si hace
          // falta separar el hallazgo de v2/prices/latest del de
          // prices_for_dates en algún análisis.
          ...(usedLatestFoundFallback ? { viaLatestFound: true } : {}),
        };
        // Esta ruta no tenía NINGÚN precio antes — cualquier mes real que
        // haya devuelto algo es mejor que el estimado curado solo, así
        // que sí se escribe a `livePrices` sin importar qué ventana ganó
        // ni si vino del fallback de v2/prices/latest.
        await setDocument("livePrices", livePriceDocId(pair.destinationId, pair.originAirportCode), liveEntry, credentials);
        written += 1;
        await recordFlightPriceHistory(liveEntry, "provider_api", credentials);

        const deal = evaluateFlightDeal(liveEntry, destById.get(pair.destinationId), curatedSnapshots);
        dealUpdates.push({ destinationId: pair.destinationId, originAirportCode: pair.originAirportCode, deal });
      }
    } catch (err) {
      console.error(`[price-sync] travelpayouts-gaps ${pair.destinationId} from ${pair.originAirportCode}: failed`, err);
      skipped += 1;
    }
    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }

  await updateDealsIndex(credentials, dealUpdates);

  return { processed: gapPairs.length, written, skipped };
}

// ---------- Muestreo profundo de rutas prioritarias (2026-08-18) ----------
//
// A pedido del usuario ("seamos recursivos... exprimir al máximo las
// herramientas gratis"), tras adaptar el consejo del head (agrupar por
// anticipación 7/14/30/60/90, sacar percentiles) a lo que Travelpayouts
// permite de forma confiable (caché pasivo, granularidad de mes). En vez
// de esperar ~3 días a que la rotación día-a-día del cron principal
// (runFlightBatch) pase por las 3 ventanas para CADA una de las 952 rutas,
// esta corrida aparte barre solo un subconjunto chico y prioritario, una
// combinación (ruta × ventana) por vez, así ese subconjunto junta las 3
// ventanas en ~1 día en vez de ~3.
//
// Prioridad = tráfico REAL, no una lista inventada (a pedido explícito del
// usuario): salió de `?mode=top-routes` el 2026-08-18, cruzando los
// orígenes más buscados (search_performed) con los destinos más
// clickeados (recommendation_clicked) de los últimos ~1000 eventos reales.
// OJO — esa lectura NO filtra tráfico propio de pruebas de sesiones
// anteriores que no llevaban isTest:true (el filtro isTest solo excluye
// eventos marcados explícitamente); PTY dominando el conteo casi seguro
// reflejaba en parte uso del propio fundador, no solo visitantes. Es la
// mejor señal real disponible hoy, no dato perfecto — conviene volver a
// correr `?mode=top-routes` dentro de unas semanas (cuando haya más
// tráfico orgánico post-SEO) y reemplazar las 2 listas de abajo a mano.
const PRIORITY_ORIGIN_HUBS = ["PTY", "DFW", "MIA", "ATL", "JFK", "LAX", "GDL", "DEN", "PHX", "YUL"];
const PRIORITY_DESTINATION_IDS = [
  "las-vegas",
  "medellin",
  "cancun",
  "curacao",
  "miami",
  "grand-cayman",
  "whistler",
  "cabo-san-lucas",
  "banff",
  "oaxaca",
  "aspen",
  "aruba",
  "mazatlan",
  "puerto-vallarta",
  "montego-bay",
  "orlando",
  "san-diego",
  "panama-city",
  "costa-rica-guanacaste",
  "guadalajara",
];

function buildPriorityRoutes(): RoutePair[] {
  return buildAllRoutePairs().filter(
    (p) => PRIORITY_ORIGIN_HUBS.includes(p.originAirportCode) && PRIORITY_DESTINATION_IDS.includes(p.destinationId)
  );
}

// 197 rutas × 3 ventanas = 591 combinaciones. A 20/lote cada 15 min
// (PRIORITY_CRON), un lote completo tarda ~7.5h — dentro de 1 día se
// completan más de 2 vueltas enteras a las 3 ventanas para todo el
// subconjunto prioritario.
const PRIORITY_BATCH_SIZE = 20;

async function runPriorityBatch(env: Env): Promise<{ processed: number; written: number; skipped: number; nextOffset: number; total: number }> {
  const credentials = credentialsFrom(env);
  const priorityRoutes = buildPriorityRoutes();

  const sequence: { pair: RoutePair; monthsAhead: number }[] = [];
  for (const monthsAhead of ADVANCE_MONTHS_BUCKETS) {
    for (const pair of priorityRoutes) sequence.push({ pair, monthsAhead });
  }

  const cursorDoc = await getDocument("livePrices", "_priorityCursor", credentials);
  const offset = typeof cursorDoc?.offset === "number" ? cursorDoc.offset : 0;

  const batch: { pair: RoutePair; monthsAhead: number }[] = [];
  for (let i = 0; i < PRIORITY_BATCH_SIZE && i < sequence.length; i++) {
    batch.push(sequence[(offset + i) % sequence.length]);
  }

  let written = 0;
  let skipped = 0;
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const curatedSnapshots = generateAllPriceSnapshots(destinations);
  const dealUpdates: { destinationId: string; originAirportCode: string; deal: ReturnType<typeof evaluateFlightDeal> }[] = [];

  for (const { pair, monthsAhead } of batch) {
    try {
      const period = periodForMonthsAhead(monthsAhead);
      const fare = await fetchCheapestFare(pair, env.TRAVELPAYOUTS_TOKEN, period);
      if (!fare) {
        skipped += 1;
      } else {
        const capturedAt = new Date().toISOString();
        const liveEntry = {
          destinationId: pair.destinationId,
          originAirportCode: pair.originAirportCode,
          avgFlightCostUSD: Math.round(fare.price),
          avgFlightDurationMinutes: Math.round(fare.durationOneWay),
          transfers: fare.transfers,
          airline: fare.airline,
          searchPeriod: period,
          capturedAt,
          advanceMonthsBucket: monthsAhead,
        };
        // Siempre alimenta priceHistory (el objetivo real de este cron).
        // Solo pisa `livePrices`/dealsCache cuando cae en la ventana de
        // ~30 días — la misma que ya usan runFlightBatch/GapBatch — para
        // no hacerle ver al usuario un precio que saltó de anticipación
        // sin que el mercado se haya movido.
        await recordFlightPriceHistory(liveEntry, "provider_api", credentials);
        if (monthsAhead === 1) {
          await setDocument("livePrices", livePriceDocId(pair.destinationId, pair.originAirportCode), liveEntry, credentials);
          const deal = evaluateFlightDeal(liveEntry, destById.get(pair.destinationId), curatedSnapshots);
          dealUpdates.push({ destinationId: pair.destinationId, originAirportCode: pair.originAirportCode, deal });
        }
        written += 1;
      }
    } catch (err) {
      console.error(`[price-sync] priority ${pair.destinationId} from ${pair.originAirportCode} (${monthsAhead}mo): failed`, err);
      skipped += 1;
    }
    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }

  if (dealUpdates.length > 0) await updateDealsIndex(credentials, dealUpdates);

  const nextOffset = (offset + PRIORITY_BATCH_SIZE) % sequence.length;
  await setDocument("livePrices", "_priorityCursor", { offset: nextOffset }, credentials);

  return { processed: batch.length, written, skipped, nextOffset, total: sequence.length };
}

// ---------- Hoteles (Xotelo, un hotel ancla curado por destino) ----------

const HOTEL_TRIP_NIGHTS = 5;

function hotelCheckInOut(): { checkIn: string; checkOut: string } {
  const now = new Date();
  const checkInDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + HOTEL_TRIP_NIGHTS);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { checkIn: fmt(checkInDate), checkOut: fmt(checkOutDate) };
}

async function fetchHotelNightlyRate(hotelKey: string): Promise<number | null> {
  const { checkIn, checkOut } = hotelCheckInOut();
  const url = new URL("https://data.xotelo.com/api/rates");
  url.searchParams.set("hotel_key", hotelKey);
  url.searchParams.set("chk_in", checkIn);
  url.searchParams.set("chk_out", checkOut);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn(`[price-sync] hotel ${hotelKey}: HTTP ${res.status}`);
    return null;
  }

  const body = (await res.json()) as { error: string | null; result?: { rates?: Array<{ rate?: number }> } };
  if (body.error || !body.result?.rates || body.result.rates.length === 0) return null;

  const rates = body.result.rates.map((r) => r.rate).filter((r): r is number => typeof r === "number" && r > 0);
  if (rates.length === 0) return null;

  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

const HOTEL_TIERS = ["budget", "mid", "premium"] as const;

async function runHotelBatch(env: Env): Promise<{ processed: number; written: number; skipped: number; nextOffset: number; total: number }> {
  const credentials = credentialsFrom(env);

  const allDestinationIds = Object.keys(HOTEL_KEYS).sort();
  const cursorDoc = await getDocument("liveHotelPrices", "_cursor", credentials);
  const offset = typeof cursorDoc?.offset === "number" ? cursorDoc.offset : 0;

  const batch: string[] = [];
  for (let i = 0; i < HOTEL_BATCH_SIZE && i < allDestinationIds.length; i++) {
    batch.push(allDestinationIds[(offset + i) % allDestinationIds.length]);
  }

  let written = 0;
  let skipped = 0;

  for (const destinationId of batch) {
    const keys = HOTEL_KEYS[destinationId];
    // Campos flat, no un objeto anidado — el cliente de Firestore
    // (packages/data/src/firestore.ts) solo sabe serializar valores
    // planos (string/number/boolean/Date), no mapValue. apps/app
    // reconstruye la forma {budget?, mid, premium?} al leer.
    const rates: { budget?: number; mid?: number; premium?: number } = {};

    for (const tier of HOTEL_TIERS) {
      const key = keys[tier];
      if (!key) continue;
      try {
        const nightly = await fetchHotelNightlyRate(key);
        if (nightly) rates[tier] = Math.round(nightly);
      } catch (err) {
        console.error(`[price-sync] hotel ${destinationId} (${tier}): failed`, err);
      }
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }

    // mid es obligatorio en LiveHotelPrice — sin él no hay nada útil que
    // escribir esta vuelta, se reintenta en el próximo ciclo del cursor.
    if (typeof rates.mid !== "number") {
      skipped += 1;
      continue;
    }

    const hotelEntry = {
      destinationId,
      avgHotelBudgetUSD: rates.budget as number | undefined,
      avgHotelMidUSD: rates.mid,
      avgHotelPremiumUSD: rates.premium as number | undefined,
      capturedAt: new Date().toISOString(),
    };
    await setDocument("liveHotelPrices", destinationId, hotelEntry, credentials);
    written += 1;
    await recordHotelPriceHistory(hotelEntry, credentials);
  }

  const nextOffset = allDestinationIds.length === 0 ? 0 : (offset + HOTEL_BATCH_SIZE) % allDestinationIds.length;
  await setDocument("liveHotelPrices", "_cursor", { offset: nextOffset, updatedAt: new Date().toISOString() }, credentials);

  return { processed: batch.length, written, skipped, nextOffset, total: allDestinationIds.length };
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const job =
      controller.cron === HOTEL_CRON
        ? runHotelBatch(env)
        : controller.cron === SERPAPI_CRON
          ? runSerpApiBatch(env)
          : controller.cron === PRIORITY_CRON
            ? runPriorityBatch(env)
            : runFlightBatch(env);
    const label =
      controller.cron === HOTEL_CRON
        ? "hotels"
        : controller.cron === SERPAPI_CRON
          ? "serpapi"
          : controller.cron === PRIORITY_CRON
            ? "priority"
            : "flights";
    ctx.waitUntil(
      job
        .then((summary) => console.log(`[price-sync] ${label} batch done`, summary))
        .catch((err) => console.error(`[price-sync] ${label} batch failed`, err))
    );
  },

  // Disparo manual para probar sin esperar al cron — protegido por un
  // secret simple (no hay nada sensible del lado del usuario acá, es un
  // worker interno sin dominio público conocido, pero evita que cualquiera
  // que adivine la URL gaste el rate limit de la API a lo pavo).
  // ?mode=hotels|serpapi para probar esos lotes; por default corre vuelos
  // (Travelpayouts).
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // timingSafeEqual en vez de !== — auditoría de seguridad, 2026-08-10.
    if (!timingSafeEqual(url.searchParams.get("key") ?? "", env.PRICE_SYNC_TRIGGER_KEY)) {
      return new Response("Not found", { status: 404 });
    }
    const mode = url.searchParams.get("mode");
    // ?mode=gaps — diagnóstico de solo lectura (no gasta cupo de SerpApi
    // ni escribe nada), para ver qué rutas elegiría el próximo lote y
    // cuántos destinos siguen en 0 cobertura total.
    if (mode === "gaps") {
      const credentials = credentialsFrom(env);
      const liveDocs = await listDocuments("livePrices", credentials);
      const liveEntries = liveDocs.filter((d) => d.id !== "_cursor");
      const liveCountByDest = new Map<string, number>();
      for (const doc of liveEntries) {
        const id = doc.destinationId as string;
        liveCountByDest.set(id, (liveCountByDest.get(id) ?? 0) + 1);
      }
      const zeroCoverage = destinations.filter((d) => (liveCountByDest.get(d.id) ?? 0) === 0).map((d) => d.id);
      const nextBatch = await getLeastCoveredGapRoutes(credentials, SERPAPI_BATCH_SIZE, liveEntries);
      const inspectId = url.searchParams.get("destinationId");
      const inspectRoutes = inspectId
        ? liveEntries
            .filter((d) => d.destinationId === inspectId)
            .map((d) => ({
              origin: d.originAirportCode,
              price: d.avgFlightCostUSD,
              durationMin: d.avgFlightDurationMinutes,
              transfers: d.transfers,
              airline: d.airline,
              source: d.source ?? "provider_api",
              capturedAt: d.capturedAt,
            }))
        : undefined;
      const priceHistoryCount = await countDocuments("priceHistory", credentials);
      return new Response(
        JSON.stringify(
          {
            totalLiveRoutes: liveEntries.length,
            priceHistoryDocsSoFar: priceHistoryCount,
            destinationsWithZeroCoverage: zeroCoverage,
            nextBatchWouldPick: nextBatch.map((p) => `${p.destinationId} from ${p.originAirportCode}`),
            ...(inspectRoutes ? { [`${inspectId}LiveRoutes`]: inspectRoutes } : {}),
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    // ?mode=bias-check — diagnóstico de solo lectura (2026-08-18, a pedido
    // del usuario: "buscar el gap real contra Kiwi"). Compara, ruta por
    // ruta, la tarifa que trajo Travelpayouts (ancla = más barata de TODO
    // el mes, ver fetchCheapestFare) contra la que trajo SerpApi (ancla =
    // una fecha puntual ~70 días adelante, metodológicamente más parecida
    // a lo que un usuario ve en Kiwi) para las rutas donde `priceHistory`
    // ya tiene AMBAS fuentes — mide con datos propios reales cuánto sesgo
    // a la baja mete el "mínimo del mes" de Travelpayouts, en vez de
    // asumir un número de memoria.
    if (mode === "bias-check") {
      const credentials = credentialsFrom(env);
      // Acotado (2026-08-19, tras un 429 real de Firestore por agotar la
      // cuota gratis de 50k lecturas/día) — antes era listDocuments SIN
      // límite, es decir TODA `priceHistory` de punta a punta. Esa
      // colección solo crece (nunca se pisa nada), así que ese costo iba
      // a subir solo con el tiempo — y esto lo llama la rutina automática
      // semanal, no solo yo a mano. La comparación de abajo solo usa la
      // captura MÁS RECIENTE de cada fuente por ruta de todos modos, así
      // que ordenar por fecha y cortar en un número generoso (~1 semana
      // de las 4 crons combinadas) da el mismo resultado real sin releer
      // meses de historial cada vez que crezca la colección.
      const historyDocs = await queryDocuments("priceHistory", credentials, {
        orderByField: "capturedAt",
        direction: "DESCENDING",
        limit: 3000,
      });
      const flightDocs = historyDocs.filter((d) => d.type === "flight");

      type HistoryEntry = { price: number; capturedAt: string };
      const bySource = new Map<string, { provider_api: HistoryEntry[]; serpapi: HistoryEntry[] }>();
      for (const doc of flightDocs) {
        const key = livePriceDocId(doc.destinationId as string, doc.originAirportCode as string);
        const entry = bySource.get(key) ?? { provider_api: [], serpapi: [] };
        const price = doc.avgFlightCostUSD as number;
        const capturedAt = doc.capturedAt as string;
        if (doc.source === "provider_api") entry.provider_api.push({ price, capturedAt });
        else if (doc.source === "serpapi") entry.serpapi.push({ price, capturedAt });
        bySource.set(key, entry);
      }

      // Más reciente de cada fuente por ruta — no promedio de todo el
      // historial, para no mezclar capturas de meses/temporadas distintas.
      const latest = (entries: HistoryEntry[]): HistoryEntry | undefined =>
        entries.length === 0 ? undefined : entries.reduce((a, b) => (a.capturedAt > b.capturedAt ? a : b));

      const comparisons: { route: string; travelpayoutsPrice: number; serpApiPrice: number; ratio: number }[] = [];
      for (const [route, entry] of bySource) {
        const tp = latest(entry.provider_api);
        const sa = latest(entry.serpapi);
        if (!tp || !sa || sa.price <= 0) continue;
        comparisons.push({ route, travelpayoutsPrice: tp.price, serpApiPrice: sa.price, ratio: tp.price / sa.price });
      }

      const avgRatio = comparisons.length > 0 ? comparisons.reduce((sum, c) => sum + c.ratio, 0) / comparisons.length : null;

      return new Response(
        JSON.stringify(
          {
            totalPriceHistoryDocs: historyDocs.length,
            flightHistoryDocs: flightDocs.length,
            routesWithBothSources: comparisons.length,
            avgTravelpayoutsToSerpApiRatio: avgRatio,
            interpretation:
              avgRatio === null
                ? "Todavía no hay rutas con ambas fuentes en priceHistory — falta acumular más días."
                : avgRatio < 1
                  ? `En promedio Travelpayouts muestra ${Math.round((1 - avgRatio) * 100)}% menos que SerpApi en estas rutas.`
                  : `En promedio Travelpayouts muestra ${Math.round((avgRatio - 1) * 100)}% más que SerpApi en estas rutas.`,
            comparisons,
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ?mode=top-routes — diagnóstico de solo lectura (2026-08-18, para
    // priorizar el muestreo profundo de PRIORITY_ROUTES con datos de
    // tráfico REAL en vez de adivinar una lista — a pedido explícito del
    // usuario de no inventar rutas fuera de lo que ya manejamos). Cuenta
    // origen (de search_performed) y destino (de recommendation_clicked,
    // señal más fuerte que "shown" — es interés real, no solo que se le
    // mostró) sobre los últimos eventos reales, cruza contra las rutas que
    // el catálogo ya soporta (buildAllRoutePairs) y devuelve las que más
    // aparecen de cada lado. No se llama en el cron — es manual, para
    // recalcular PRIORITY_ROUTES cada tanto a mano, no en cada corrida
    // (leer `events` completo sería caro hacerlo seguido).
    if (mode === "top-routes") {
      const credentials = credentialsFrom(env);
      const recentEvents = await queryDocuments("events", credentials, {
        orderByField: "createdAt",
        direction: "DESCENDING",
        limit: 2000,
      });

      const originCounts = new Map<string, number>();
      const destinationCounts = new Map<string, number>();
      for (const ev of recentEvents) {
        if (ev.isTest === true) continue; // no contar tráfico de QA propio
        if (ev.name === "search_performed" && typeof ev.originAirportCode === "string") {
          originCounts.set(ev.originAirportCode, (originCounts.get(ev.originAirportCode) ?? 0) + 1);
        }
        if (ev.name === "recommendation_clicked" && typeof ev.destinationId === "string") {
          destinationCounts.set(ev.destinationId, (destinationCounts.get(ev.destinationId) ?? 0) + 1);
        }
      }

      const topN = (counts: Map<string, number>, n: number) =>
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, n)
          .map(([id, count]) => ({ id, count }));

      const topOrigins = topN(originCounts, 10);
      const topDestinations = topN(destinationCounts, 40);
      const topOriginIds = new Set(topOrigins.map((o) => o.id));
      const topDestinationIds = new Set(topDestinations.map((d) => d.id));

      const allPairs = buildAllRoutePairs();
      const priorityCandidates = allPairs.filter(
        (p) => topOriginIds.has(p.originAirportCode) && topDestinationIds.has(p.destinationId)
      );

      return new Response(
        JSON.stringify(
          {
            eventsScanned: recentEvents.length,
            topOrigins,
            topDestinations,
            priorityCandidateCount: priorityCandidates.length,
            priorityCandidates: priorityCandidates.map((p) => `${p.destinationId} from ${p.originAirportCode}`),
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    const refreshDestinationId = url.searchParams.get("destinationId");
    const summary =
      mode === "hotels"
        ? await runHotelBatch(env)
        : mode === "serpapi-refresh" && refreshDestinationId
          ? await runSerpApiRefreshForDestination(refreshDestinationId, env)
          : mode === "serpapi"
            ? await runSerpApiBatch(env)
            : mode === "travelpayouts-gaps"
              ? await runTravelpayoutsGapBatch(env)
              : mode === "priority"
                ? await runPriorityBatch(env)
                : await runFlightBatch(env);
    return new Response(JSON.stringify(summary, null, 2), { headers: { "Content-Type": "application/json" } });
  },
} satisfies ExportedHandler<Env>;
