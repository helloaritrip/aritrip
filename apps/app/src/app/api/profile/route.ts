import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDocument, setDocument, ORIGIN_HUBS, type OriginHub } from "@aritrips/data";
import { getUserSession } from "@/lib/requireUserSession";
import { corsHeaders } from "@/lib/cors";
import { INTEREST_VALUES, type SavedProfile, type InterestTag } from "@/lib/interestOptions";

/**
 * Perfil simple (2026-08-26, a pedido del usuario) — 3 campos que el
 * buscador ya le pide en cada búsqueda (origen/presupuesto/intereses),
 * guardados en `users/{uid}` como preferencias, no como un formulario
 * nuevo que inventar. Se leen/escriben con getDocument/setDocument
 * directo (mismo doc que ya crea /api/auth/google) — merge manual porque
 * setDocument reemplaza el documento COMPLETO (ver nota en firestore.ts).
 */

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const headers = corsHeaders(request.headers.get("origin"));
  const session = await getUserSession(request, env);
  if (!session) return NextResponse.json({ profile: null }, { headers });

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return NextResponse.json({ profile: null }, { headers });
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  const doc = await getDocument("users", session.uid, credentials).catch(() => null);
  // Intereses como JSON en un campo string (2026-08-26) — toFirestoreFields
  // (packages/data/src/firestore.ts) solo sabe serializar string/number/
  // boolean/Date, sin soporte de arrayValue; mismo patrón ya usado por
  // favorites.snapshotJson para guardar listas sin tocar el cliente
  // compartido de Firestore.
  let interests: InterestTag[] | undefined;
  if (typeof doc?.preferredInterestsJson === "string") {
    try {
      const parsed = JSON.parse(doc.preferredInterestsJson);
      if (Array.isArray(parsed)) interests = parsed.filter((i) => (INTEREST_VALUES as readonly string[]).includes(i));
    } catch {
      interests = undefined;
    }
  }
  const profile: SavedProfile = {
    originAirportCode: typeof doc?.preferredOriginAirportCode === "string" ? (doc.preferredOriginAirportCode as OriginHub) : undefined,
    budgetUSD: typeof doc?.preferredBudgetUSD === "number" ? doc.preferredBudgetUSD : undefined,
    interests,
  };
  return NextResponse.json({ profile }, { headers });
}

export async function PUT(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const headers = corsHeaders(request.headers.get("origin"));
  const session = await getUserSession(request, env);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401, headers });

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return NextResponse.json({ error: "Not configured." }, { status: 503, headers });
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { originAirportCode?: string | null; budgetUSD?: number | null; interests?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
  }

  if (body.originAirportCode != null && !(ORIGIN_HUBS as readonly string[]).includes(body.originAirportCode)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 400, headers });
  }
  if (body.budgetUSD != null && (typeof body.budgetUSD !== "number" || body.budgetUSD < 0)) {
    return NextResponse.json({ error: "Invalid budget." }, { status: 400, headers });
  }
  const interests = Array.isArray(body.interests) ? body.interests.filter((i) => (INTEREST_VALUES as readonly string[]).includes(i)) : [];

  // getDocument primero + merge (2026-08-26) — mismo patrón que
  // /api/auth/google, setDocument pisa el doc entero: sin esto, guardar el
  // perfil borraría email/name/picture/createdAt del mismo documento.
  const existing = await getDocument("users", session.uid, credentials).catch(() => null);
  const merged: Record<string, unknown> = { ...(existing ?? {}), uid: session.uid, updatedAt: new Date() };
  // createdAt vuelve de Firestore como string (timestampValue decodificado,
  // ver fromFirestoreFields) — sin convertirlo de nuevo a Date, el spread
  // de arriba lo reescribiría como stringValue en vez de timestampValue.
  // Mismo fix ya aplicado en /api/auth/google/route.ts para el mismo caso.
  if (typeof merged.createdAt === "string") merged.createdAt = new Date(merged.createdAt);
  // null/undefined se cae de toFirestoreFields (ver firestore.ts) — el
  // efecto práctico es "no guardar este campo", que para un PATCH sin
  // updateMask (reemplaza el doc entero) equivale a borrarlo. Por eso se
  // borran explícitamente del objeto en vez de asignar null, así el campo
  // no sobrevive del doc anterior si el usuario limpió la preferencia.
  if (body.originAirportCode) merged.preferredOriginAirportCode = body.originAirportCode;
  else delete merged.preferredOriginAirportCode;
  if (typeof body.budgetUSD === "number") merged.preferredBudgetUSD = body.budgetUSD;
  else delete merged.preferredBudgetUSD;
  merged.preferredInterestsJson = JSON.stringify(interests);

  await setDocument("users", session.uid, merged, credentials);

  return NextResponse.json({ ok: true }, { headers });
}
