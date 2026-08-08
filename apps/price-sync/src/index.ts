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
  livePriceDocId,
  HOTEL_KEYS,
  type FirestoreCredentials,
} from "@aritrips/data";

export interface Env {
  TRAVELPAYOUTS_TOKEN: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  PRICE_SYNC_TRIGGER_KEY: string;
}

// Ver wrangler.jsonc — deben quedar idénticos a "triggers.crons" para que
// el dispatcher de abajo sepa cuál corrida le toca a cada uno.
const HOTEL_CRON = "5-59/20 * * * *";

// Encontrado en producción (2026-08-07): con 40 tiraba "Too many
// subrequests by single Worker invocation" — el plan free de Workers
// limita a 50 subrequests/invocación, esto deja margen de sobra.
const BATCH_SIZE = 15;
const HOTEL_BATCH_SIZE = 15;
// ~1 request/segundo — margen de sobra frente al límite de 60/min de
// Travelpayouts; Xotelo no publica un límite pero se mantiene el mismo
// ritmo por prolijidad, no hay apuro.
const DELAY_BETWEEN_REQUESTS_MS = 1100;

function credentialsFrom(env: Env): FirestoreCredentials {
  return { clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextMonthPeriod(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

// ---------- Vuelos (Travelpayouts Data API) ----------

interface RoutePair {
  destinationId: string;
  originAirportCode: string;
  destinationAirportCode: string;
}

function buildAllRoutePairs(): RoutePair[] {
  const pairs: RoutePair[] = [];
  const destById = new Map(destinations.map((d) => [d.id, d]));

  for (const destinationId of Object.keys(originBaseCosts).sort()) {
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

async function fetchCheapestFare(pair: RoutePair, token: string): Promise<TravelpayoutsFare | null> {
  const period = nextMonthPeriod();
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.searchParams.set("origin", pair.originAirportCode);
  url.searchParams.set("destination", pair.destinationAirportCode);
  url.searchParams.set("departure_at", period);
  url.searchParams.set("return_at", period);
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

  const body = (await res.json()) as {
    success: boolean;
    data?: Array<{ price: number; duration: number; duration_to?: number; transfers: number; airline: string }>;
  };
  if (!body.success || !body.data || body.data.length === 0) return null;

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

  for (const pair of batch) {
    try {
      const fare = await fetchCheapestFare(pair, env.TRAVELPAYOUTS_TOKEN);
      if (!fare) {
        skipped += 1;
      } else {
        await setDocument(
          "livePrices",
          livePriceDocId(pair.destinationId, pair.originAirportCode),
          {
            destinationId: pair.destinationId,
            originAirportCode: pair.originAirportCode,
            avgFlightCostUSD: Math.round(fare.price),
            avgFlightDurationMinutes: Math.round(fare.durationOneWay),
            transfers: fare.transfers,
            airline: fare.airline,
            capturedAt: new Date().toISOString(),
          },
          credentials
        );
        written += 1;
      }
    } catch (err) {
      console.error(`[price-sync] flight ${pair.destinationId} from ${pair.originAirportCode}: failed`, err);
      skipped += 1;
    }
    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }

  const nextOffset = (offset + BATCH_SIZE) % allPairs.length;
  await setDocument("livePrices", "_cursor", { offset: nextOffset, updatedAt: new Date().toISOString() }, credentials);

  return { processed: batch.length, written, skipped, nextOffset, total: allPairs.length };
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
    try {
      const nightly = await fetchHotelNightlyRate(HOTEL_KEYS[destinationId]);
      if (!nightly) {
        skipped += 1;
      } else {
        await setDocument(
          "liveHotelPrices",
          destinationId,
          { destinationId, avgHotelCostPerNightUSD: Math.round(nightly), capturedAt: new Date().toISOString() },
          credentials
        );
        written += 1;
      }
    } catch (err) {
      console.error(`[price-sync] hotel ${destinationId}: failed`, err);
      skipped += 1;
    }
    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }

  const nextOffset = allDestinationIds.length === 0 ? 0 : (offset + HOTEL_BATCH_SIZE) % allDestinationIds.length;
  await setDocument("liveHotelPrices", "_cursor", { offset: nextOffset, updatedAt: new Date().toISOString() }, credentials);

  return { processed: batch.length, written, skipped, nextOffset, total: allDestinationIds.length };
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const job = controller.cron === HOTEL_CRON ? runHotelBatch(env) : runFlightBatch(env);
    const label = controller.cron === HOTEL_CRON ? "hotels" : "flights";
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
  // ?mode=hotels para probar el lote de hoteles; por default corre vuelos.
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.searchParams.get("key") !== env.PRICE_SYNC_TRIGGER_KEY) {
      return new Response("Not found", { status: 404 });
    }
    const summary = url.searchParams.get("mode") === "hotels" ? await runHotelBatch(env) : await runFlightBatch(env);
    return new Response(JSON.stringify(summary, null, 2), { headers: { "Content-Type": "application/json" } });
  },
} satisfies ExportedHandler<Env>;
