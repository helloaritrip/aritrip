import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  destinations,
  generateAllPriceSnapshots,
  applyLivePriceOverlay,
  applyLiveHotelPriceOverlay,
  applyImageOverlay,
  getDiscoverDetail,
  ORIGIN_HUBS,
  type OriginHub,
} from "@aritrips/data";
import { getPartnerConfig, buildPartnerLinks } from "@/lib/partnerLinks";
import { getLivePrices, getLiveHotelPrices } from "@/lib/livePrices";
import { getLiveImages } from "@/lib/liveImages";

const curatedPriceSnapshots = generateAllPriceSnapshots(destinations);

/**
 * Detalle completo de un destino para la card de Discover al hacer clic
 * — ver getDiscoverDetail en packages/data para por qué no reusa el motor
 * de recomendación completo (necesita presupuesto/intereses que todavía
 * no existen en este punto del flujo).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const destinationId = searchParams.get("id");
  const origin = searchParams.get("origin");

  if (!destinationId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (!origin || !(ORIGIN_HUBS as readonly string[]).includes(origin)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });

  // Rate limit (2026-08-19, auditoría de seguridad) — mismo motivo que
  // /api/recommendations: lecturas reales de Firestore por cada llamada.
  const destinationLimiter = (env as unknown as { DESTINATION_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> } })
    .DESTINATION_LIMITER;
  if (destinationLimiter) {
    const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await destinationLimiter.limit({ key: clientIp });
    if (!success) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const [livePrices, liveHotelPrices, liveImages] = await Promise.all([
    getLivePrices({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
    getLiveHotelPrices({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
    getLiveImages({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
  ]);
  const priceSnapshots = applyLiveHotelPriceOverlay(applyLivePriceOverlay(curatedPriceSnapshots, livePrices), liveHotelPrices);
  const destinationsWithImages = applyImageOverlay(destinations, liveImages);

  const detail = getDiscoverDetail(destinationId, origin as OriginHub, destinationsWithImages, priceSnapshots);
  if (!detail) {
    return NextResponse.json({ error: "Destination not available from this origin" }, { status: 404 });
  }

  const partnerConfig = await getPartnerConfig({
    FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY,
  });
  const links = buildPartnerLinks(
    {
      originAirportCode: origin,
      destinationAirportCode: detail.destinationAirportCode,
      destinationName: detail.name,
      startDate: detail.startDate,
      endDate: detail.endDate,
      adults: detail.adults,
    },
    partnerConfig
  );

  return NextResponse.json({ ...detail, links });
}
