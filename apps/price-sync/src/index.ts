/**
 * Worker chico y separado (2026-08-07) cuyo único trabajo es mantener la
 * colección `livePrices` de Firestore con precios de vuelo reales,
 * consultados a la API de datos de Travelpayouts (misma cuenta que ya
 * usamos para Kiwi.com — no hace falta una cuenta nueva). apps/app lee
 * esa colección (ver apps/app/src/lib/livePrices.ts) y recalibra los
 * estimados curados de packages/data con esto — ver
 * packages/data/src/livePrices.ts para el porqué de recalibrar en vez
 * de reemplazar.
 *
 * Nadie dispara esto a mano en el día a día: Cloudflare lo despierta
 * solo cada 15 minutos (ver wrangler.jsonc). Cero costo/dependencia de
 * Claude en runtime — es un cron job común y corriente.
 *
 * Por qué en lotes y no todo de una: el catálogo tiene 952 combinaciones
 * origen×destino y la API gratuita limita a 60 consultas/minuto. Cada
 * corrida procesa un lote (BATCH_SIZE) y guarda en Firestore en qué
 * lote se quedó (`livePrices/_cursor`) para retomar ahí la próxima vez
 * — un ciclo completo del catálogo tarda unas horas, después arranca de
 * nuevo solo, así los precios se mantienen frescos de forma continua
 * sin arriesgar el rate limit ni pasarse del tiempo de ejecución de una
 * sola invocación.
 *
 * Nota (2026-08-07): se intentó sumar el mismo tratamiento para hoteles
 * vía la Hotellook Data API — descartado de inmediato, Hotellook cerró
 * como marca en octubre 2025 y su API (engine.hotellook.com) ya no
 * existe (404 en todo el dominio). Sin reemplazo activo conocido todavía
 * en Travelpayouts — hotel/actividades siguen siendo 100% estimado
 * curado, sin overlay real.
 */
import { destinations, originBaseCosts, getDocument, setDocument, livePriceDocId, type FirestoreCredentials } from "@aritrips/data";

export interface Env {
  TRAVELPAYOUTS_TOKEN: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  PRICE_SYNC_TRIGGER_KEY: string;
}

// Cloudflare Workers (plan free) limita a 50 subrequests salientes por
// invocación — cada ruta gasta hasta 2 (Travelpayouts + Firestore), más
// ~3 de overhead fijo (lectura/escritura del cursor + el intercambio de
// token OAuth de Firestore) — 15 deja margen de sobra. Encontrado en
// producción (2026-08-07): con 40 tiraba "Too many subrequests by
// single Worker invocation".
const BATCH_SIZE = 15;
// ~1 request/segundo, bien por debajo del límite de 60/min de la API de
// datos de Travelpayouts — margen a propósito, no hace falta apurar.
const DELAY_BETWEEN_REQUESTS_MS = 1100;

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

function nextMonthPeriod(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

interface TravelpayoutsFare {
  price: number;
  duration: number;
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
    console.warn(`[price-sync] ${pair.destinationId} from ${pair.originAirportCode}: HTTP ${res.status}`);
    return null;
  }

  const body = (await res.json()) as { success: boolean; data?: Array<{ price: number; duration: number; transfers: number; airline: string }> };
  if (!body.success || !body.data || body.data.length === 0) return null;

  const fare = body.data[0];
  if (typeof fare.price !== "number" || fare.price <= 0) return null;

  return { price: fare.price, duration: fare.duration ?? 0, transfers: fare.transfers ?? 0, airline: fare.airline ?? "" };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBatch(env: Env): Promise<{ processed: number; written: number; skipped: number; nextOffset: number; total: number }> {
  const credentials: FirestoreCredentials = {
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };

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
            avgFlightDurationMinutes: Math.round(fare.duration),
            transfers: fare.transfers,
            airline: fare.airline,
            capturedAt: new Date().toISOString(),
          },
          credentials
        );
        written += 1;
      }
    } catch (err) {
      console.error(`[price-sync] ${pair.destinationId} from ${pair.originAirportCode}: failed`, err);
      skipped += 1;
    }
    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }

  const nextOffset = (offset + BATCH_SIZE) % allPairs.length;
  await setDocument("livePrices", "_cursor", { offset: nextOffset, updatedAt: new Date().toISOString() }, credentials);

  return { processed: batch.length, written, skipped, nextOffset, total: allPairs.length };
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runBatch(env)
        .then((summary) => console.log("[price-sync] batch done", summary))
        .catch((err) => console.error("[price-sync] batch failed", err))
    );
  },

  // Disparo manual para probar sin esperar al cron — protegido por un
  // secret simple (no hay nada sensible del lado del usuario acá, es un
  // worker interno sin dominio público conocido, pero evita que cualquiera
  // que adivine la URL gaste el rate limit de la API a lo pavo).
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.searchParams.get("key") !== env.PRICE_SYNC_TRIGGER_KEY) {
      return new Response("Not found", { status: 404 });
    }
    const summary = await runBatch(env);
    return new Response(JSON.stringify(summary, null, 2), { headers: { "Content-Type": "application/json" } });
  },
} satisfies ExportedHandler<Env>;
