import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  destinations,
  generateAllPriceSnapshots,
  getRecommendations,
  ORIGIN_HUBS,
  type OriginHub,
  type InterestTag,
} from "@aritrips/data";
import { getPartnerConfig, buildPartnerLinks } from "@/lib/partnerLinks";

// Fase 1 (MVP): catálogo y precios 100% estáticos, generados en memoria —
// no depende de Firestore todavía. Ver Data Model / Affiliate Integration
// & API Contracts para el contrato completo y el plan de reemplazo por
// datos reales en Fase 2.
const priceSnapshots = generateAllPriceSnapshots(destinations);

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
  if (!Array.isArray(interests) || interests.length === 0) {
    return NextResponse.json({ error: "Pick at least one interest" }, { status: 400 });
  }

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
    destinations,
    priceSnapshots
  );

  // Mismo mes que usa el motor para Season Fit (ver recommend.ts) — acá se
  // reexpone como texto/temperatura real para el usuario, no un placeholder.
  const month = new Date(startDate).getMonth() + 1;

  // Resuelto una sola vez por búsqueda (no por resultado) — getPartnerConfig
  // ya cachea en memoria ~5 min, pero no hace falta ni ese trabajo repetido
  // dentro del mismo request.
  const { env } = await getCloudflareContext({ async: true });
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
        finalScore: r.finalScore,
        subScores: r.subScores,
        reasons: r.reasons,
        rank: r.rank,
        imageQuery: r.destination.imageQuery,
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
