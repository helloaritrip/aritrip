import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { writeFirestoreDocument } from "@/lib/firestore";

const VALID_CATEGORIES = ["flight", "hotel", "activity", "insurance", "esim"];
const SUB_SCORE_KEYS = ["budgetFit", "activitiesMatch", "seasonFit", "weatherComfort", "travelTime", "valueRating", "safety"] as const;

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

type SubScores = Record<(typeof SUB_SCORE_KEYS)[number], number>;

function isValidSubScores(v: unknown): v is SubScores {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return SUB_SCORE_KEYS.every((key) => isFiniteNumberInRange(obj[key], 0, 100));
}

type ValidatedEvent =
  | { name: "search_performed"; searchId: string; originAirportCode: string; budgetUSD: number; isTest: boolean }
  | {
      name: "recommendation_shown";
      searchId: string;
      destinationId: string;
      rank: number;
      finalScore: number;
      subScores: SubScores;
      isTest: boolean;
    }
  | { name: "recommendation_clicked"; searchId?: string; destinationId: string; rank?: number; category: string; isTest: boolean };

// isTest (2026-08-11) — las propias pruebas de QA contra producción
// generaban búsquedas reales indistinguibles de las de un visitante real,
// contaminando el conteo hacia las 1,000 búsquedas de la Fase 2. Ver
// apps/app/src/lib/testMode.ts. `!== true` en vez de solo leer el
// booleano: clientes viejos (antes de este deploy) no mandan el campo,
// así que ausente = evento real, no test.
function readIsTest(body: Record<string, unknown>): boolean {
  return body.isTest === true;
}

function validateEvent(body: Record<string, unknown>): ValidatedEvent | null {
  const isTest = readIsTest(body);
  switch (body.name) {
    case "search_performed":
      if (isShortString(body.searchId, 64) && isShortString(body.originAirportCode, 8) && isFiniteNumberInRange(body.budgetUSD, 0, 1_000_000)) {
        return { name: "search_performed", searchId: body.searchId, originAirportCode: body.originAirportCode, budgetUSD: body.budgetUSD, isTest };
      }
      return null;
    case "recommendation_shown":
      if (
        isShortString(body.searchId, 64) &&
        isShortString(body.destinationId, 64) &&
        isFiniteNumberInRange(body.rank, 0, 1000) &&
        isFiniteNumberInRange(body.finalScore, 0, 100) &&
        isValidSubScores(body.subScores)
      ) {
        return {
          name: "recommendation_shown",
          searchId: body.searchId,
          destinationId: body.destinationId,
          rank: body.rank,
          finalScore: body.finalScore,
          subScores: body.subScores,
          isTest,
        };
      }
      return null;
    case "recommendation_clicked": {
      if (!isShortString(body.destinationId, 64) || typeof body.category !== "string" || !VALID_CATEGORIES.includes(body.category)) {
        return null;
      }
      // searchId/rank son opcionales acá (ver trackEvent.ts) — el modal
      // de Discover dispara este mismo evento sin venir de una búsqueda
      // de Ari Core. Si vienen, tienen que ser válidos; si no vienen, se
      // omiten en vez de forzar un valor falso.
      if (body.searchId !== undefined && !isShortString(body.searchId, 64)) return null;
      if (body.rank !== undefined && !isFiniteNumberInRange(body.rank, 0, 1000)) return null;
      return {
        name: "recommendation_clicked",
        searchId: body.searchId as string | undefined,
        destinationId: body.destinationId,
        rank: body.rank as number | undefined,
        category: body.category,
        isTest,
      };
    }
    default:
      return null;
  }
}

// Firestore (ver toFirestoreFields en packages/data/src/firestore.ts) solo
// guarda campos planos — string/number/boolean/Date, nada anidado. subScores
// llega como objeto, así que se aplana a 7 campos sueltos antes de escribir
// (no se toca el cliente compartido de Firestore por esto).
function toFirestoreDoc(event: ValidatedEvent): Record<string, unknown> {
  if (event.name !== "recommendation_shown") return { ...event };
  const { subScores, ...rest } = event;
  const flatSubScores = Object.fromEntries(SUB_SCORE_KEYS.map((key) => [`subScore_${key}`, subScores[key]]));
  return { ...rest, ...flatSubScores };
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
      { ...toFirestoreDoc(event), createdAt: new Date() },
      { clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }
    );
    return NextResponse.json({ tracked: true });
  } catch (err) {
    console.error("[track] Firestore write failed", err);
    // Best-effort: un fallo de analytics no debe verse como error al usuario.
    return NextResponse.json({ tracked: false, reason: "write_failed" });
  }
}
