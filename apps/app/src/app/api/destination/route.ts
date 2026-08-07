import { NextResponse } from "next/server";
import { destinations, generateAllPriceSnapshots, getDiscoverDetail, ORIGIN_HUBS, type OriginHub } from "@aritrips/data";

const priceSnapshots = generateAllPriceSnapshots(destinations);

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

  const detail = getDiscoverDetail(destinationId, origin as OriginHub, destinations, priceSnapshots);
  if (!detail) {
    return NextResponse.json({ error: "Destination not available from this origin" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
