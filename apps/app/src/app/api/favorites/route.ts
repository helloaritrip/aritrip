import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { queryDocuments, setDocument, deleteDocument } from "@aritrips/data";
import { getUserSession } from "@/lib/requireUserSession";
import { corsHeaders } from "@/lib/cors";

type FavoriteItemType = "destination" | "deal";

function favoriteDocId(uid: string, itemType: FavoriteItemType, itemId: string): string {
  return `${uid}_${itemType}_${itemId}`;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const headers = corsHeaders(request.headers.get("origin"));
  const session = await getUserSession(request, env);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401, headers });

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return NextResponse.json({ error: "Not configured." }, { status: 503, headers });
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  // Filtro real en Firestore (where uid == ...), no listDocuments + filtro
  // en memoria (2026-08-14) — esto último traía la colección `favorites`
  // ENTERA (todos los usuarios) en cada carga de /favorites, exactamente
  // el mismo antipatrón que agotó la cuota gratis de Firestore con /deals
  // (ver apps/www/src/lib/dealsCache.ts). Con más usuarios esto solo iba
  // a empeorar.
  const docs = await queryDocuments("favorites", credentials, { where: { field: "uid", op: "EQUAL", value: session.uid } });
  const favorites = docs
    .map((d) => {
      let snapshot: unknown = null;
      try {
        snapshot = typeof d.snapshotJson === "string" ? JSON.parse(d.snapshotJson) : null;
      } catch {
        snapshot = null;
      }
      return {
        itemType: d.itemType as FavoriteItemType,
        itemId: d.itemId as string,
        snapshot,
        createdAt: d.createdAt as string,
      };
    })
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  return NextResponse.json({ favorites }, { headers });
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const headers = corsHeaders(request.headers.get("origin"));
  const session = await getUserSession(request, env);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401, headers });

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return NextResponse.json({ error: "Not configured." }, { status: 503, headers });
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { itemType?: string; itemId?: string; snapshot?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
  }
  if ((body.itemType !== "destination" && body.itemType !== "deal") || !body.itemId) {
    return NextResponse.json({ error: "Missing itemType/itemId." }, { status: 400, headers });
  }

  const docId = favoriteDocId(session.uid, body.itemType, body.itemId);
  await setDocument(
    "favorites",
    docId,
    {
      uid: session.uid,
      itemType: body.itemType,
      itemId: body.itemId,
      snapshotJson: JSON.stringify(body.snapshot ?? {}),
      createdAt: new Date(),
    },
    credentials
  );

  return NextResponse.json({ ok: true }, { headers });
}

export async function DELETE(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const headers = corsHeaders(request.headers.get("origin"));
  const session = await getUserSession(request, env);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401, headers });

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return NextResponse.json({ error: "Not configured." }, { status: 503, headers });
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { itemType?: string; itemId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
  }
  if ((body.itemType !== "destination" && body.itemType !== "deal") || !body.itemId) {
    return NextResponse.json({ error: "Missing itemType/itemId." }, { status: 400, headers });
  }

  await deleteDocument("favorites", favoriteDocId(session.uid, body.itemType, body.itemId), credentials);
  return NextResponse.json({ ok: true }, { headers });
}
