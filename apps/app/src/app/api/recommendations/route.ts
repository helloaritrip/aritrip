import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  destinations,
  generateAllPriceSnapshots,
  getRecommendations,
  applyLivePriceOverlay,
  applyLiveHotelPriceOverlay,
  applyImageOverlay,
  ORIGIN_HUBS,
  type OriginHub,
  type InterestTag,
} from "@aritrips/data";
import { getPartnerConfig, buildPartnerLinks } from "@/lib/partnerLinks";
import { getLivePrices, getLiveHotelPrices } from "@/lib/livePrices";
import { getLiveImages } from "@/lib/liveImages";

// Fase 1 (MVP): catálogo 100% estático, generado en memoria. Los precios
// de vuelo empezaron como estimados curados a mano puros (2026-08-05);
// desde 2026-08-07 se recalibran con precios reales cuando hay uno
// disponible para esa ruta (ver apps/price-sync + applyLivePriceOverlay)
// — el estimado curado sigue siendo la base y el fallback, nunca se
// descarta. Ver Data Model / Affiliate Integration & API Contracts para
// el contrato completo.
const curatedPriceSnapshots = generateAllPriceSnapshots(destinations);

// Debe quedar igual al union real en packages/data/src/types.ts — hoy un
// valor no reconocido caía silenciosamente a un puntaje neutral de 50,
// que no rompía nada mas era por casualidad del diseño, no por
// validación real (auditoría de seguridad, 2026-08-10).
const VALID_INTERESTS: InterestTag[] = ["beach", "adventure", "culture", "nightlife", "family", "honeymoon"];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { originAirportCode, budgetUSD, startDate, endDate, adults, children, interests } = body;

  if (typeof originAirportCode !== "string" || !ORIGIN_HUBS.includes(originAirportCode as OriginHub)) {
    return NextResponse.json({ error: "Invalid originAirportCode" }, { status: 400 });
  }
  if (typeof budgetUSD !== "number" || budgetUSD <= 0) {
    return NextResponse.json({ error: "budgetUSD must be a positive number" }, { status: 400 });
  }
  if (typeof startDate !== "string" || typeof endDate !== "string" || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing startDate/endDate" }, { status: 400 });
  }
  if (new Date(endDate) <= new Date(startDate)) {
    return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
  }
  if (!Array.isArray(interests) || interests.length === 0 || !interests.every((i) => VALID_INTERESTS.includes(i as InterestTag))) {
    return NextResponse.json({ error: "Pick at least one interest" }, { status: 400 });
  }

  // Resuelto una sola vez por búsqueda, antes de puntuar — getLivePrices y
  // getPartnerConfig ya cachean en memoria (1h y 5min respectivamente), así
  // que esto no le pega a Firestore en cada búsqueda.
  const { env } = await getCloudflareContext({ async: true });
  const [livePrices, liveHotelPrices, liveImages] = await Promise.all([
    getLivePrices({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
    getLiveHotelPrices({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
    getLiveImages({ FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY }),
  ]);
  const priceSnapshots = applyLiveHotelPriceOverlay(applyLivePriceOverlay(curatedPriceSnapshots, livePrices), liveHotelPrices);
  const destinationsWithImages = applyImageOverlay(destinations, liveImages);

  const results = getRecommendations(
    {
      originAirportCode: originAirportCode as OriginHub,
      budgetUSD,
      startDate,
      endDate,
      adults: Number(adults) || 1,
      children: Number(children) || 0,
      interests: interests as InterestTag[],
    },
    destinationsWithImages,
    priceSnapshots
  );

  // Mismo mes que usa el motor para Season Fit (ver recommend.ts) — acá se
  // reexpone como texto/temperatura real para el usuario, no un placeholder.
  const month = new Date(startDate).getMonth() + 1;

  const partnerConfig = await getPartnerConfig({
    FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY,
  });

  return NextResponse.json({
    recommendations: results.map((r) => {
      const season = r.destination.seasons.find((s) => s.months.includes(month));
      return {
        destinationId: r.destination.id,
        destinationAirportCode: r.destination.airportCodes[0],
        name: r.destination.name,
        country: r.destination.country,
        totalEstimatedCostUSD: Math.round(r.totalEstimatedCostUSD),
        costBreakdown: {
          flightUSD: Math.round(r.costBreakdown.flightUSD),
          hotelUSD: Math.round(r.costBreakdown.hotelUSD),
          activitiesUSD: Math.round(r.costBreakdown.activitiesUSD),
        },
        flightPriceRange: {
          minUSD: Math.round(r.flightPriceRange.minUSD),
          maxUSD: Math.round(r.flightPriceRange.maxUSD),
          confidence: r.flightPriceRange.confidence,
        },
        flightTransfers: r.flightTransfers ?? null,
        flightAirline: r.flightAirline ?? null,
        finalScore: r.finalScore,
        subScores: r.subScores,
        reasons: r.reasons,
        rank: r.rank,
        imageQuery: r.destination.imageQuery,
        imageUrl: r.destination.imageUrl ?? null,
        weather: season
          ? { avgTempMinC: season.avgTempC.min, avgTempMaxC: season.avgTempC.max, rainfallLevel: season.rainfallLevel }
          : null,
        links: buildPartnerLinks(
          {
            originAirportCode: originAirportCode as OriginHub,
            destinationAirportCode: r.destination.airportCodes[0],
            destinationName: r.destination.name,
            startDate,
            endDate,
            adults: Number(adults) || 1,
          },
          partnerConfig
        ),
      };
    }),
  });
}
