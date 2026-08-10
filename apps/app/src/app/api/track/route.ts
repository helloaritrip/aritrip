import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { writeFirestoreDocument } from "@/lib/firestore";

const VALID_CATEGORIES = ["flight", "hotel", "activity", "insurance", "esim"];

// Auditoría de seguridad (2026-08-10): antes esto validaba solo `name` y
// escribía el resto del body tal cual a Firestore ({ ...body }) — mass
// assignment sin límite de tamaño, alcanzable por cualquiera sin login
// (costo real de escrituras + datos de analytics basura). Ahora valida
// la forma exacta de cada uno de los 3 eventos reales (ver
// src/lib/trackEvent.ts) y construye el documento a mano, campo por
// campo — nunca se vuelve a spreadear el body crudo.
function isShortString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

function isFiniteNumberInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

type ValidatedEvent =
  | { name: "search_performed"; originAirportCode: string; budgetUSD: number }
  | { name: "recommendation_shown"; destinationId: string; rank: number; finalScore: number }
  | { name: "recommendation_clicked"; destinationId: string; category: string };

function validateEvent(body: Record<string, unknown>): ValidatedEvent | null {
  switch (body.name) {
    case "search_performed":
      if (isShortString(body.originAirportCode, 8) && isFiniteNumberInRange(body.budgetUSD, 0, 1_000_000)) {
        return { name: "search_performed", originAirportCode: body.originAirportCode, budgetUSD: body.budgetUSD };
      }
      return null;
    case "recommendation_shown":
      if (isShortString(body.destinationId, 64) && isFiniteNumberInRange(body.rank, 0, 1000) && isFiniteNumberInRange(body.finalScore, 0, 100)) {
        return { name: "recommendation_shown", destinationId: body.destinationId, rank: body.rank, finalScore: body.finalScore };
      }
      return null;
    case "recommendation_clicked":
      if (isShortString(body.destinationId, 64) && typeof body.category === "string" && VALID_CATEGORIES.includes(body.category)) {
        return { name: "recommendation_clicked", destinationId: body.destinationId, category: body.category };
      }
      return null;
    default:
      return null;
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = validateEvent(body);
  if (!event) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;

  // Sin credenciales configuradas (ej. entorno local sin .dev.vars), no
  // rompemos la búsqueda del usuario por un evento de analytics — solo
  // no se persiste. Igual que el placeholder anterior, honesto en vez de
  // fingir.
  if (!clientEmail || !privateKey) {
    return NextResponse.json({ tracked: false, reason: "not_configured" });
  }

  try {
    await writeFirestoreDocument(
      "events",
      { ...event, createdAt: new Date() },
      { clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }
    );
    return NextResponse.json({ tracked: true });
  } catch (err) {
    console.error("[track] Firestore write failed", err);
    // Best-effort: un fallo de analytics no debe verse como error al usuario.
    return NextResponse.json({ tracked: false, reason: "write_failed" });
  }
}
