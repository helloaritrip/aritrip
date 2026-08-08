import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  destinations,
  generateAllPriceSnapshots,
  applyLivePriceOverlay,
  applyLiveHotelPriceOverlay,
  getDiscoverDetail,
  ORIGIN_HUBS,
  type OriginHub,
} from "@aritrips/data";
import { getPartnerConfig, buildPartnerLinks } from "@/lib/partnerLinks";
import { getLivePrices, getLiveHotelPrices } from "@/lib/livePrices";

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
  const [livePrices, liveHotelPrices] = await Promise.all([
    getLivePrices({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
    getLiveHotelPrices({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
  ]);
  const priceSnapshots = applyLiveHotelPriceOverlay(applyLivePriceOverlay(curatedPriceSnapshots, livePrices), liveHotelPrices);

  const detail = getDiscoverDetail(destinationId, origin as OriginHub, destinations, priceSnapshots);
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
