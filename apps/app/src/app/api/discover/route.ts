import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  destinations,
  generateAllPriceSnapshots,
  applyLivePriceOverlay,
  applyLiveHotelPriceOverlay,
  getDiscoverPicks,
  nearestOriginHub,
  DEFAULT_ORIGIN_HUB,
  ORIGIN_HUBS,
  type OriginHub,
} from "@aritrips/data";
import { getLivePrices, getLiveHotelPrices } from "@/lib/livePrices";

const curatedPriceSnapshots = generateAllPriceSnapshots(destinations);

/**
 * Ubicación por IP vía Cloudflare (request.cf) — gratis, sin permiso del
 * navegador, sin cuenta de terceros. En `next dev` funciona gracias a
 * initOpenNextCloudflareForDev() en next.config.ts; si no hay señal
 * (entorno sin Cloudflare, o visitante sin cf.latitude/longitude), cae al
 * hub por defecto. `?origin=` fuerza un hub para probar sin depender de
 * dónde esté conectado quien prueba.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const originOverride = searchParams.get("origin");

  let originAirportCode: OriginHub = DEFAULT_ORIGIN_HUB;
  let detectionSource: "override" | "geo" | "default" = "default";

  if (originOverride && (ORIGIN_HUBS as readonly string[]).includes(originOverride)) {
    originAirportCode = originOverride as OriginHub;
    detectionSource = "override";
  } else {
    try {
      const { cf } = await getCloudflareContext({ async: true });
      const lat = cf && typeof cf.latitude === "string" ? parseFloat(cf.latitude) : undefined;
      const lon = cf && typeof cf.longitude === "string" ? parseFloat(cf.longitude) : undefined;
      if (lat !== undefined && lon !== undefined && !Number.isNaN(lat) && !Number.isNaN(lon)) {
        originAirportCode = nearestOriginHub({ lat, lon });
        detectionSource = "geo";
      }
    } catch {
      // getCloudflareContext puede no estar disponible en algunos entornos — usamos el default.
    }
  }

  const { env } = await getCloudflareContext({ async: true });
  const [livePrices, liveHotelPrices] = await Promise.all([
    getLivePrices({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
    getLiveHotelPrices({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
  ]);
  const priceSnapshots = applyLiveHotelPriceOverlay(applyLivePriceOverlay(curatedPriceSnapshots, livePrices), liveHotelPrices);

  const picks = getDiscoverPicks(originAirportCode, destinations, priceSnapshots);

  return NextResponse.json({ originAirportCode, detectionSource, picks });
}
