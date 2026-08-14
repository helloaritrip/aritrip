import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { queryDocuments, deleteDocument } from "@aritrips/data";
import { getUserSession, USER_SESSION_COOKIE } from "@/lib/requireUserSession";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

/**
 * Borra la cuenta y todos los datos asociados (2026-08-15, roadmap de
 * privacidad post Google Sign-In). Todo lo que un usuario logueado tiene
 * hoy en Firestore vive en solo 2 lugares:
 *  - `users/{uid}` — 1 doc, perfil (nombre/email/foto de Google).
 *  - `favorites` — N docs, uno por ítem guardado (ver favorites/route.ts
 *    para el mismo query por uid, ya probado ahí).
 * Los eventos de `events` (search_performed, deal_clicked, etc.) NO se
 * tocan acá a propósito — nunca llevan uid, son anónimos por diseño (ver
 * trackEvent.ts), así que no hay nada personal ahí que borrar.
 */
export async function DELETE(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const headers = corsHeaders(request.headers.get("origin"));
  const session = await getUserSession(request, env);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401, headers });

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return NextResponse.json({ error: "Not configured." }, { status: 503, headers });
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  try {
    const favoriteDocs = await queryDocuments("favorites", credentials, { where: { field: "uid", op: "EQUAL", value: session.uid } });
    await Promise.all(favoriteDocs.map((d) => deleteDocument("favorites", d.id, credentials)));
    await deleteDocument("users", session.uid, credentials);
  } catch (err) {
    console.error("[account] Failed to delete account data", err);
    return NextResponse.json({ error: "Couldn't delete your data right now. Try again in a moment." }, { status: 500, headers });
  }

  const res = NextResponse.json({ ok: true }, { headers });
  // Mismo criterio que /api/auth/logout — la sesión firmada no vive en
  // Firestore (JWT sin estado), así que "cerrarla" es solo vencer la
  // cookie ya. Sin esto, el navegador seguiría mandando un token válido
  // para un uid que ya no tiene perfil ni favoritos.
  res.cookies.set(USER_SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: ".aritrips.com", maxAge: 0 });
  return res;
}
